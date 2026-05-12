"use client";

// Repo for downloading server-generated, sealed-to-user PDFs.
// Server returns { url, sealed } — if sealed, fetch ciphertext, open in worker.

import { getCryptoWorker } from "@/lib/crypto/worker/client";

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

function bytesToAB(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}
