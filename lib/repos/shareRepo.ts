"use client";

// Share repo. Owner side: wrap item DEK to recipient pubkey via crypto_box_seal.
// Recipient side: unwrap with own X25519 priv (held in worker), then decrypt
// item ciphertext with the recovered DEK.

import { getCryptoWorker } from "@/lib/crypto/worker/client";
import { INFO } from "@/lib/crypto/keyManager";
import { getRecipientPubkey } from "./cryptoRepo";

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

// --- Owner side ---

export async function shareItemWithEmail(args: { itemId: string; recipientEmail: string }): Promise<void> {
  const recip = await getRecipientPubkey({ email: args.recipientEmail });
  await shareItem({ itemId: args.itemId, recipientUserId: recip.userId, recipientPub: recip.pubX25519 });
}

export async function shareItem(args: {
  itemId: string;
  recipientUserId: string;
  recipientPub: Uint8Array;
}): Promise<void> {
  const worker = getCryptoWorker();
  // Wrap the FILES-DEK; for db-only items wrap DB-DEK instead. Caller sets info.
  // Simplification: share files (most common). DB items would re-use this with INFO.DB.
  const wrapped = await worker.wrapDekForRecipient(INFO.FILES, args.recipientPub);
  const myPub = (await worker.publicKeys()).x25519;

  const res = await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      itemId: args.itemId,
      recipientUserId: args.recipientUserId,
      wrappedDek: b64(wrapped),
      senderPubkey: b64(myPub),
      encVersion: 1,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `share failed: ${res.status}`);
  }
}

export type OutgoingShare = {
  id: string;
  itemId: string;
  recipientUserId: string;
  encVersion: number | null;
  createdAt: string;
  revokedAt: string | null;
};

export async function listOutgoingShares(itemId?: string): Promise<OutgoingShare[]> {
  const q = new URLSearchParams({ direction: "out" });
  if (itemId) q.set("itemId", itemId);
  const res = await fetch(`/api/share?${q}`);
  if (!res.ok) throw new Error(`list outgoing failed: ${res.status}`);
  const j = await res.json() as { shares: Array<{
    id: string; item_id: string; recipient_user_id: string;
    enc_version: number | null; created_at: string; revoked_at: string | null;
  }> };
  return j.shares.map(s => ({
    id: s.id,
    itemId: s.item_id,
    recipientUserId: s.recipient_user_id,
    encVersion: s.enc_version,
    createdAt: s.created_at,
    revokedAt: s.revoked_at,
  }));
}

export async function revokeShare(shareId: string): Promise<void> {
  const res = await fetch(`/api/share?id=${encodeURIComponent(shareId)}`, { method: "DELETE" });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `revoke failed: ${res.status}`);
  }
}

// --- Recipient side ---

export type IncomingShare = {
  id: string;
  itemId: string;
  category: string;
  storagePath: string | null;
  createdAt: string;
  // Plaintext-after-decryption is fetched on demand; we expose helpers below.
  wrappedDek: Uint8Array;
  itemCiphertext: Uint8Array | null;
  itemNonce: Uint8Array | null;
};

type RawIncoming = {
  id: string;
  itemId: string;
  wrappedDek: string | Uint8Array;
  senderPubkey: string | Uint8Array;
  encVersion: number | null;
  createdAt: string;
  item: {
    id: string;
    category: string;
    ciphertext: string | Uint8Array | null;
    nonce: string | Uint8Array | null;
    storage_path: string | null;
  } | null;
};

export async function listIncomingShares(): Promise<IncomingShare[]> {
  const res = await fetch("/api/share?direction=in");
  if (!res.ok) throw new Error(`list incoming failed: ${res.status}`);
  const { shares } = await res.json() as { shares: RawIncoming[] };

  const out: IncomingShare[] = [];
  for (const s of shares) {
    if (!s.item) continue;
    out.push({
      id: s.id,
      itemId: s.itemId,
      category: s.item.category,
      storagePath: s.item.storage_path,
      createdAt: s.createdAt,
      wrappedDek: decodeBytea(s.wrappedDek)!,
      itemCiphertext: decodeBytea(s.item.ciphertext),
      itemNonce: decodeBytea(s.item.nonce),
    });
  }
  return out;
}

// Decrypt a shared item's metadata (label/data JSON envelope). DEK never
// leaves the worker — sealed box is opened + AEAD decrypt happens inside.
export async function decryptSharedMetadata(share: IncomingShare): Promise<{ label: string; data: Record<string, unknown> }> {
  if (!share.itemCiphertext) throw new Error("no ciphertext on shared item");
  const worker = getCryptoWorker();
  const pt = await worker.decryptSharedItem(share.wrappedDek, share.itemCiphertext);
  return JSON.parse(new TextDecoder().decode(pt)) as { label: string; data: Record<string, unknown> };
}
