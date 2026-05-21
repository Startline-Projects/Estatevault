"use client";

// Repo for downloading server-generated, sealed-to-user PDFs.
// Server returns { url, sealed } — if sealed, fetch ciphertext, open in worker.

import { getCryptoWorker } from "@/lib/crypto/worker/client";
import { authedFetch } from "@/lib/api/authedFetch";

export type DownloadResult = {
  blob: Blob;
  filename: string;
};

export async function downloadGeneratedDocument(documentId: string, filename = "document.pdf"): Promise<DownloadResult> {
  const meta = await fetch(`/api/documents/download?id=${encodeURIComponent(documentId)}`);
  if (!meta.ok) {
    const j = await meta.json().catch(() => ({}));
    throw new Error(j.error ?? `download meta failed: ${meta.status}`);
  }
  const { url, sealed } = await meta.json() as { url: string; sealed: boolean };

  const fileRes = await fetch(url);
  if (!fileRes.ok) throw new Error(`storage fetch failed: ${fileRes.status}`);
  const bytes = new Uint8Array(await fileRes.arrayBuffer());

  if (!sealed) {
    return { blob: new Blob([bytesToAB(bytes)], { type: "application/pdf" }), filename };
  }

  const worker = getCryptoWorker();
  const pt = await worker.openSealedBox(bytes);
  return { blob: new Blob([bytesToAB(pt)], { type: "application/pdf" }), filename };
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Attorney-only: download the editable DOCX generated for review. Sealed copies
// are opened in the crypto worker with the attorney's key.
export async function downloadReviewDocx(documentId: string): Promise<DownloadResult> {
  const meta = await authedFetch(`/api/attorney/review-docx?documentId=${encodeURIComponent(documentId)}`);
  if (!meta.ok) {
    const j = await meta.json().catch(() => ({}));
    throw new Error(j.error ?? `download meta failed: ${meta.status}`);
  }
  const { url, sealed, filename } = await meta.json() as { url: string; sealed: boolean; filename: string };

  const fileRes = await fetch(url);
  if (!fileRes.ok) throw new Error(`storage fetch failed: ${fileRes.status}`);
  const bytes = new Uint8Array(await fileRes.arrayBuffer());

  const name = filename || "document.docx";
  if (!sealed) {
    return { blob: new Blob([bytesToAB(bytes)], { type: DOCX_MIME }), filename: name };
  }

  const worker = getCryptoWorker();
  const pt = await worker.openSealedBox(bytes);
  return { blob: new Blob([bytesToAB(pt)], { type: DOCX_MIME }), filename: name };
}

function bytesToAB(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}
