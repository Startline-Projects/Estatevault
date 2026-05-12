"use client";

// Farewell video repo. Streams ciphertext via secretstream worker session
// and PUTs to signed URL with one HTTP request. Header (24B) stored separately
// on farewell_messages so streaming reads can init pull before fetching chunks.

import { getCryptoWorker } from "@/lib/crypto/worker/client";
import { INFO } from "@/lib/crypto/keyManager";

const CHUNK = 256 * 1024; // 256 KiB

function b64(b: Uint8Array): string {
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function decodeBytea(raw: string | Uint8Array | null | undefined): Uint8Array | null {
  if (raw == null) return null;
  if (raw instanceof Uint8Array) return raw;
  if (typeof raw === "string") {
    if (raw.startsWith("\\x")) {
      const hex = raw.slice(2);
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
      return out;
    }
    return fromB64(raw);
  }
  return null;
}

type SignedUploadResp = {
  bucket: string;
  path: string;
  signedUrl: string;
  sizeLimit: number;
};

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

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

// Encrypt full blob to framed ciphertext Blob (4B-BE length || ct per chunk).
// Buffered to a Blob so PUT has a known Content-Length — Supabase Storage
// rejects chunked/streaming PUTs with 400.
async function encryptToBlob(plaintext: Blob, sessionId: string): Promise<Blob> {
  const worker = getCryptoWorker();
  const reader = plaintext.stream().getReader();
  const parts: BlobPart[] = [];
  let buffer = new Uint8Array(0);
  let done = false;

  while (!done) {
    while (buffer.length < CHUNK && !done) {
      const r = await reader.read();
      if (r.done) { done = true; break; }
      const next = new Uint8Array(buffer.length + r.value.length);
      next.set(buffer, 0); next.set(r.value, buffer.length);
      buffer = next;
    }
    const take = Math.min(CHUNK, buffer.length);
    const chunk = buffer.slice(0, take);
    buffer = buffer.slice(take);
    const isFinal = done && buffer.length === 0;
    const ct = await worker.pushEncryptStream(sessionId, chunk, isFinal);
    parts.push(u32be(ct.length));
    parts.push(ct);
    if (isFinal) break;
  }

  if (parts.length === 0) {
    const ct = await worker.pushEncryptStream(sessionId, new Uint8Array(0), true);
    parts.push(u32be(ct.length));
    parts.push(ct);
  }

  return new Blob(parts, { type: "application/octet-stream" });
}

export type UploadFarewellArgs = {
  blob: Blob;                       // recorded or selected video
  title: string;
  recipientEmail: string;
  durationSeconds?: number;
};

export type UploadFarewellResult = {
  messageId: string;
  storagePath: string;
};

export async function uploadFarewell(args: UploadFarewellArgs): Promise<UploadFarewellResult> {
  const worker = getCryptoWorker();

  const signed = await getSignedUpload(args.blob.size);
  if (args.blob.size > signed.sizeLimit) throw new Error("file too large");

  // Begin worker session
  const { sessionId, header } = await worker.beginEncryptStream(INFO.FILES);

  // Encrypt to a Blob first so PUT has a known Content-Length.
  // Supabase Storage returns 400 on chunked/streaming PUTs.
  const cipherBlob = await encryptToBlob(args.blob, sessionId);

  const putRes = await fetch(signed.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream", "x-upsert": "true" },
    body: cipherBlob,
  });

  if (!putRes.ok) {
    await worker.endStream(sessionId).catch(() => undefined);
    throw new Error(`storage upload failed: ${putRes.status}`);
  }

  // Encrypt metadata (title + recipient_email) + blind index
  const meta = JSON.stringify({ title: args.title, recipient_email: args.recipientEmail });
  const env = await worker.encryptBytes(new TextEncoder().encode(meta), INFO.DB);
  const recipientBlind = await worker.blindIndex(args.recipientEmail.trim().toLowerCase());

  const res = await fetch("/api/vault/farewell", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ciphertext: b64(env.envelope),
      nonce: b64(env.nonce),
      recipientBlind: b64(recipientBlind),
      storageHeader: b64(header),
      storagePath: signed.path,
      fileSizeMb: Number((args.blob.size / 1024 / 1024).toFixed(2)),
      durationSeconds: args.durationSeconds,
      encVersion: 1,
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
  storageHeader: Uint8Array | null;
  createdAt: string;
  updatedAt: string;
};

type RawFarewellRow = {
  id: string;
  title: string | null;
  recipient_email: string | null;
  file_size_mb: number | null;
  duration_seconds: number | null;
  vault_farewell_status: string;
  created_at: string;
  updated_at: string;
  // E2EE rows (Phase 9). The list endpoint may not return these yet; safe-defaults below.
  ciphertext?: string | Uint8Array | null;
  nonce?: string | Uint8Array | null;
  enc_version?: number | null;
  storage_path?: string | null;
  storage_header?: string | Uint8Array | null;
};

export async function listFarewellMessages(): Promise<FarewellMessagePlaintext[]> {
  const res = await fetch("/api/vault/farewell");
  if (!res.ok) throw new Error(`farewell list failed: ${res.status}`);
  const j = await res.json() as { messages: RawFarewellRow[] };
  const worker = getCryptoWorker();

  const out: FarewellMessagePlaintext[] = [];
  for (const r of j.messages ?? []) {
    const ct = decodeBytea(r.ciphertext);
    const header = decodeBytea(r.storage_header);
    if (ct) {
      try {
        const pt = await worker.decryptBytes(ct, INFO.DB);
        const meta = JSON.parse(new TextDecoder().decode(pt)) as { title: string; recipient_email: string };
        out.push({
          id: r.id,
          title: meta.title ?? "",
          recipientEmail: meta.recipient_email ?? "",
          fileSizeMb: r.file_size_mb,
          durationSeconds: r.duration_seconds,
          status: r.vault_farewell_status,
          encrypted: true,
          storagePath: r.storage_path ?? null,
          storageHeader: header,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        });
      } catch {
        out.push({
          id: r.id,
          title: "[decryption failed]",
          recipientEmail: "",
          fileSizeMb: r.file_size_mb,
          durationSeconds: r.duration_seconds,
          status: r.vault_farewell_status,
          encrypted: true,
          storagePath: r.storage_path ?? null,
          storageHeader: header,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        });
      }
    } else {
      out.push({
        id: r.id,
        title: r.title ?? "",
        recipientEmail: r.recipient_email ?? "",
        fileSizeMb: r.file_size_mb,
        durationSeconds: r.duration_seconds,
        status: r.vault_farewell_status,
        encrypted: false,
        storagePath: null,
        storageHeader: null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    }
  }
  return out;
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

export async function downloadFarewell(args: {
  storagePath: string;
  storageHeader: Uint8Array;
}): Promise<Blob> {
  const dlRes = await fetch("/api/vault/download-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket: "farewell-videos", path: args.storagePath }),
  });
  if (!dlRes.ok) throw new Error(`download-url failed: ${dlRes.status}`);
  const { signedUrl } = await dlRes.json() as { signedUrl: string };

  const cipherRes = await fetch(signedUrl);
  if (!cipherRes.ok) throw new Error(`storage download failed: ${cipherRes.status}`);
  const cipherStream = cipherRes.body;
  if (!cipherStream) throw new Error("no body");

  const worker = getCryptoWorker();
  const { sessionId } = await worker.beginDecryptStream(INFO.FILES, args.storageHeader);

  const reader = cipherStream.getReader();
  let buffer = new Uint8Array(0);
  const plain: Uint8Array[] = [];
  let done = false;
  let final = false;

  function readU32be(b: Uint8Array, off: number): number {
    return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(off, false);
  }

  async function fill(min: number) {
    while (buffer.length < min && !done) {
      const r = await reader.read();
      if (r.done) { done = true; break; }
      const next = new Uint8Array(buffer.length + r.value.length);
      next.set(buffer, 0); next.set(r.value, buffer.length);
      buffer = next;
    }
    return buffer.length >= min;
  }

  while (!final) {
    if (!(await fill(4))) break;
    const len = readU32be(buffer, 0);
    buffer = buffer.slice(4);
    if (!(await fill(len))) throw new Error("truncated farewell stream");
    const ct = buffer.slice(0, len);
    buffer = buffer.slice(len);
    const out = await worker.pullDecryptStream(sessionId, ct);
    if (out.plaintext.length > 0) plain.push(out.plaintext);
    final = out.final;
  }

  await worker.endStream(sessionId).catch(() => undefined);
  return new Blob(plain.map((u) => {
    const ab = new ArrayBuffer(u.byteLength);
    new Uint8Array(ab).set(u);
    return ab;
  }));
}
