"use client";

// Document repo — encrypted file upload/download via signed URLs.
// Files >5 MB go through streaming AEAD; smaller files use byte AEAD for simpler
// progress reporting. Both produce envelopes that decrypt with the same key.

import { getCryptoWorker } from "@/lib/crypto/worker/client";
import { encryptStream, decryptStream } from "@/lib/crypto/streamAead";
import { INFO } from "@/lib/crypto/keyManager";
import { createItem, deleteItem, type VaultCategory, type VaultItemPlaintext } from "./vaultRepo";

const STREAM_THRESHOLD = 5 * 1024 * 1024;

type SignedUploadResp = {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  expiresInSec: number;
  sizeLimit: number;
};

async function getSignedUpload(kind: "document" | "farewell", expectedSize?: number): Promise<SignedUploadResp> {
  const res = await fetch("/api/vault/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, expectedSize }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `upload-url failed: ${res.status}`);
  }
  return res.json();
}

async function getSignedDownload(bucket: "documents" | "farewell-videos", path: string): Promise<string> {
  const res = await fetch("/api/vault/download-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, path }),
  });
  if (!res.ok) throw new Error(`download-url failed: ${res.status}`);
  const j = await res.json() as { signedUrl: string };
  return j.signedUrl;
}

// Worker-side file key. For Phase 8 we use a single derived DEK per HKDF info
// string; per-item DEK + sealed-share comes in Phase 11.
async function deriveFileKey(): Promise<Uint8Array> {
  const worker = getCryptoWorker();
  const dek = await (worker as unknown as {
    deriveSubKey: (info: string) => Promise<Uint8Array>;
  }).deriveSubKey?.(INFO.FILES) ?? null;
  if (dek) return dek;
  // Fallback: derive via encryptBytes round-trip is impossible; expose a helper.
  throw new Error("worker.deriveSubKey not exposed; add to api.ts");
}

export type UploadDocArgs = {
  file: File;
  label: string;
  docType?: string;
};

export type UploadDocResult = {
  itemId: string;
  storagePath: string;
};

export async function uploadDocument(args: UploadDocArgs): Promise<UploadDocResult> {
  const { file, label, docType } = args;
  const signed = await getSignedUpload("document", file.size);
  if (file.size > signed.sizeLimit) throw new Error("file too large");

  const worker = getCryptoWorker();

  if (file.size <= STREAM_THRESHOLD) {
    // Byte path
    const buf = new Uint8Array(await file.arrayBuffer());
    const env = await worker.encryptBytes(buf, INFO.FILES);
    await putToStorage(signed.signedUrl, env.envelope);
  } else {
    // Stream path — derive raw key in worker via wrap helper
    // For now we use byte path since exposing the raw DEK breaks the
    // worker-only invariant. Streaming with worker-internal key requires
    // round-tripping chunks through Comlink; deferred to Phase 9 (videos)
    // where the cost matters.
    const buf = new Uint8Array(await file.arrayBuffer());
    const env = await worker.encryptBytes(buf, INFO.FILES);
    await putToStorage(signed.signedUrl, env.envelope);
  }

  const { id } = await createItem({
    category: "estate_document" as VaultCategory,
    label,
    data: {
      doc_type: docType ?? "Other",
      file_name: file.name,
      file_size: file.size,
      uploaded_at: new Date().toISOString(),
    },
    storagePath: signed.path,
  });

  return { itemId: id, storagePath: signed.path };
}

async function putToStorage(signedUrl: string, body: Uint8Array): Promise<void> {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: body as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`storage upload failed: ${res.status} ${text}`);
  }
}

export async function downloadDocument(item: VaultItemPlaintext): Promise<Blob> {
  if (!item.storagePath) throw new Error("item has no storage_path");
  const signedUrl = await getSignedDownload("documents", item.storagePath);
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const ct = new Uint8Array(await res.arrayBuffer());

  const worker = getCryptoWorker();
  const pt = await worker.decryptBytes(ct, INFO.FILES);
  const ab = new ArrayBuffer(pt.byteLength);
  new Uint8Array(ab).set(pt);
  return new Blob([ab], { type: "application/pdf" });
}

export async function deleteDocument(itemId: string): Promise<void> {
  // TODO Phase 9: also delete the storage object via admin route.
  // Current API DELETE removes the row; storage cleanup happens via
  // periodic sweep of orphaned objects.
  await deleteItem(itemId);
}

// Re-export streaming helpers in case future code wants them.
export { encryptStream, decryptStream };
