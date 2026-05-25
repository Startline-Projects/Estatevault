"use client";

// Option A (F2): the server holds the keys. The client fetches its per-user FILES
// sub-key over TLS, encrypts the file locally, and uploads ciphertext to Storage.
// The bucket only ever holds ciphertext; the server can still decrypt (it derives
// the same key), keeping files recoverable.

import { encryptBytes, decryptBytes } from "@/lib/crypto/aead";
import { createItem, deleteItem, type VaultCategory, type VaultItemPlaintext } from "./vaultRepo";

type SignedUploadResp = {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  expiresInSec: number;
  sizeLimit: number;
};

async function getFileKey(): Promise<Uint8Array> {
  const res = await fetch("/api/vault/file-key");
  if (!res.ok) throw new Error(`file-key failed: ${res.status}`);
  const { key } = await res.json() as { key: string };
  const bin = atob(key);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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

  const fileKey = await getFileKey();
  const buf = new Uint8Array(await file.arrayBuffer());
  const env = await encryptBytes(fileKey, buf);
  await putToStorage(signed.signedUrl, env.bytes);

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
  const ab = new ArrayBuffer(body.byteLength);
  new Uint8Array(ab).set(body);
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: ab,
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

  const fileKey = await getFileKey();
  const pt = await decryptBytes(fileKey, ct);
  const ab = new ArrayBuffer(pt.byteLength);
  new Uint8Array(ab).set(pt);
  return new Blob([ab], { type: "application/pdf" });
}

export async function deleteDocument(itemId: string): Promise<void> {
  await deleteItem(itemId);
}
