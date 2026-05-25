"use client";

// Option A (F2): farewell video. Cross-platform chunked byte-AEAD ("EVC1") so
// web and Flutter produce/consume identical ciphertext (no secretstream — the
// Dart high-level API can't match libsodium's stream framing).
//
// Layout: "EVC1"(4) | version(1) | u32be(numChunks)(4) | frame*
//   frame = u32be(frameLen) | nonce(24) | ct+tag
//   ct    = XChaCha20-Poly1305-IETF(chunk, ad, nonce, fileKey)
//   ad    = utf8("ev:file:chunk:v1") | u32be(index)

import { getSodium } from "@/lib/crypto/sodium";

const CHUNK = 1024 * 1024; // 1 MiB
const MAGIC = new Uint8Array([0x45, 0x56, 0x43, 0x31]); // "EVC1"
const VERSION = 1;
const NONCE_LEN = 24;
const AD_PREFIX = new TextEncoder().encode("ev:file:chunk:v1");

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getFileKey(): Promise<Uint8Array> {
  const res = await fetch("/api/vault/file-key");
  if (!res.ok) throw new Error(`file-key failed: ${res.status}`);
  const { key } = await res.json() as { key: string };
  return fromB64(key);
}

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}
function readU32be(b: Uint8Array, off: number): number {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(off, false);
}
function u8toAB(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}
function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length);
  return out;
}
function ad(index: number): Uint8Array {
  return concat(AD_PREFIX, u32be(index));
}

type SignedUploadResp = { bucket: string; path: string; signedUrl: string; sizeLimit: number };

async function getSignedUpload(expectedSize: number): Promise<SignedUploadResp> {
  const res = await fetch("/api/vault/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "farewell", expectedSize }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `upload-url failed: ${res.status}`);
  }
  return res.json();
}

async function encryptToBlob(plaintext: Blob, fileKey: Uint8Array): Promise<Blob> {
  const s = await getSodium();
  const numChunks = Math.max(1, Math.ceil(plaintext.size / CHUNK));
  const parts: BlobPart[] = [u8toAB(MAGIC), u8toAB(new Uint8Array([VERSION])), u8toAB(u32be(numChunks))];

  const reader = plaintext.stream().getReader();
  let buffer: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  let streamDone = false;
  async function fill(min: number) {
    while (buffer.length < min && !streamDone) {
      const r = await reader.read();
      if (r.done) { streamDone = true; break; }
      buffer = concat(buffer, r.value);
    }
  }

  for (let index = 0; index < numChunks; index++) {
    await fill(CHUNK);
    const take = Math.min(CHUNK, buffer.length);
    const chunk = buffer.subarray(0, take);
    buffer = buffer.subarray(take);
    const nonce = s.randombytes_buf(NONCE_LEN);
    const ct = s.crypto_aead_xchacha20poly1305_ietf_encrypt(chunk, ad(index), null, nonce, fileKey);
    const frame = concat(nonce, ct);
    parts.push(u8toAB(u32be(frame.length)));
    parts.push(u8toAB(frame));
  }

  return new Blob(parts, { type: "application/octet-stream" });
}

export type UploadFarewellArgs = {
  blob: Blob;
  title: string;
  recipientEmail: string;
  durationSeconds?: number;
};

export type UploadFarewellResult = { messageId: string; storagePath: string };

export async function uploadFarewell(args: UploadFarewellArgs): Promise<UploadFarewellResult> {
  const signed = await getSignedUpload(args.blob.size);
  if (args.blob.size > signed.sizeLimit) throw new Error("file too large");

  const fileKey = await getFileKey();
  const cipherBlob = await encryptToBlob(args.blob, fileKey);

  const putRes = await fetch(signed.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream", "x-upsert": "true" },
    body: cipherBlob,
  });
  if (!putRes.ok) throw new Error(`storage upload failed: ${putRes.status}`);

  const res = await fetch("/api/vault/farewell", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: args.title,
      recipientEmail: args.recipientEmail,
      storagePath: signed.path,
      fileSizeMb: Number((args.blob.size / 1024 / 1024).toFixed(2)),
      durationSeconds: args.durationSeconds,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `farewell create failed: ${res.status}`);
  }
  const { id } = await res.json() as { id: string };
  return { messageId: id, storagePath: signed.path };
}

export type FarewellMessagePlaintext = {
  id: string;
  title: string;
  recipientEmail: string;
  fileSizeMb: number | null;
  durationSeconds: number | null;
  status: string;
  encrypted: boolean;
  storagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

type ServerFarewell = {
  id: string;
  title: string;
  recipientEmail: string;
  fileSizeMb: number | null;
  durationSeconds: number | null;
  status: string;
  storagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listFarewellMessages(): Promise<FarewellMessagePlaintext[]> {
  const res = await fetch("/api/vault/farewell");
  if (!res.ok) throw new Error(`farewell list failed: ${res.status}`);
  const j = await res.json() as { messages: ServerFarewell[] };
  return (j.messages ?? []).map((r) => ({
    id: r.id,
    title: r.title ?? "",
    recipientEmail: r.recipientEmail ?? "",
    fileSizeMb: r.fileSizeMb,
    durationSeconds: r.durationSeconds,
    status: r.status,
    encrypted: true,
    storagePath: r.storagePath,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function deleteFarewellMessage(messageId: string): Promise<void> {
  const res = await fetch("/api/vault/farewell", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `delete failed: ${res.status}`);
  }
}

// Decode an EVC1 farewell ciphertext blob to a playable Blob, given the raw
// FILES sub-key. Shared by the owner download path and the trustee vault view
// (which fetches the key from /api/trustee/vault/file-key) so both decode the
// same format identically.
export async function decryptFarewellCipher(cipher: Uint8Array, fileKey: Uint8Array): Promise<Blob> {
  const s = await getSodium();

  if (cipher.length < 9 || cipher[0] !== MAGIC[0] || cipher[1] !== MAGIC[1] || cipher[2] !== MAGIC[2] || cipher[3] !== MAGIC[3]) {
    throw new Error("bad magic");
  }
  if (cipher[4] !== VERSION) throw new Error("unsupported version");
  const numChunks = readU32be(cipher, 5);

  const parts: BlobPart[] = [];
  let off = 9;
  for (let index = 0; index < numChunks; index++) {
    const frameLen = readU32be(cipher, off); off += 4;
    const frame = cipher.subarray(off, off + frameLen); off += frameLen;
    const nonce = frame.subarray(0, NONCE_LEN);
    const ct = frame.subarray(NONCE_LEN);
    const pt = s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, ad(index), nonce, fileKey);
    parts.push(u8toAB(pt));
  }

  return new Blob(parts, { type: "video/mp4" });
}

export async function downloadFarewell(args: { storagePath: string }): Promise<Blob> {
  const dlRes = await fetch("/api/vault/download-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket: "farewell-videos", path: args.storagePath }),
  });
  if (!dlRes.ok) throw new Error(`download-url failed: ${dlRes.status}`);
  const { signedUrl } = await dlRes.json() as { signedUrl: string };

  const cipherRes = await fetch(signedUrl);
  if (!cipherRes.ok) throw new Error(`storage download failed: ${cipherRes.status}`);
  const cipher = new Uint8Array(await cipherRes.arrayBuffer());

  const fileKey = await getFileKey();
  return decryptFarewellCipher(cipher, fileKey);
}
