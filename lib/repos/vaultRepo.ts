"use client";

// Client-side vault repo. All plaintext lives in caller scope; encrypt before
// network. Decrypt incoming rows that have ciphertext; pass legacy rows through.

import { getCryptoWorker } from "@/lib/crypto/worker/client";
import { INFO } from "@/lib/crypto/keyManager";

function b64(b: Uint8Array): string {
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Server returns Postgres bytea as `\x...` hex string OR base64 depending on
// PostgREST `bytea_output` setting. Detect and decode either.
function decodeBytea(raw: string | Uint8Array | null): Uint8Array | null {
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

export type VaultCategory =
  | "estate_document" | "insurance" | "financial_account" | "digital_account"
  | "physical_location" | "contact" | "final_wishes" | "business";

export type VaultItemPlaintext = {
  id: string;
  category: VaultCategory;
  label: string;
  data: Record<string, unknown>;
  storagePath: string | null;
  encrypted: boolean;
  createdAt: string;
};

type RawRow = {
  id: string;
  category: VaultCategory;
  label: string | null;
  data: Record<string, unknown> | null;
  ciphertext: string | Uint8Array | null;
  nonce: string | Uint8Array | null;
  enc_version: number | null;
  label_blind: string | Uint8Array | null;
  storage_path: string | null;
  created_at: string;
};

export async function listItems(): Promise<VaultItemPlaintext[]> {
  const res = await fetch("/api/vault/items");
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  const { items } = await res.json() as { items: RawRow[] };
  const worker = getCryptoWorker();

  const out: VaultItemPlaintext[] = [];
  for (const r of items) {
    const ct = decodeBytea(r.ciphertext);
    if (ct) {
      try {
        const pt = await worker.decryptBytes(ct, INFO.DB);
        const parsed = JSON.parse(new TextDecoder().decode(pt)) as { label: string; data: Record<string, unknown> };
        out.push({
          id: r.id, category: r.category,
          label: parsed.label, data: parsed.data,
          storagePath: r.storage_path,
          encrypted: true,
          createdAt: r.created_at,
        });
      } catch {
        // Skip rows that fail to decrypt (foreign key or wrong-MK indicator).
        out.push({
          id: r.id, category: r.category,
          label: "[decryption failed]", data: {},
          storagePath: r.storage_path,
          encrypted: true,
          createdAt: r.created_at,
        });
      }
    } else {
      out.push({
        id: r.id, category: r.category,
        label: r.label ?? "", data: r.data ?? {},
        storagePath: null,
        encrypted: false,
        createdAt: r.created_at,
      });
    }
  }
  return out;
}

export async function createItem(args: {
  category: VaultCategory;
  label: string;
  data: Record<string, unknown>;
  storagePath?: string | null;
}): Promise<{ id: string }> {
  const worker = getCryptoWorker();
  const payload = new TextEncoder().encode(JSON.stringify({ label: args.label, data: args.data }));
  const env = await worker.encryptBytes(payload, INFO.DB);
  const labelBlindBytes = await worker.blindIndex(args.label);

  const res = await fetch("/api/vault/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: args.category,
      ciphertext: b64(env.envelope),
      nonce: b64(env.nonce),
      labelBlind: b64(labelBlindBytes),
      encVersion: 1,
      storagePath: args.storagePath ?? undefined,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `create failed: ${res.status}`);
  }
  const { item } = await res.json() as { item: { id: string } };
  return item;
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`/api/vault/items?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `delete failed: ${res.status}`);
  }
}

export async function searchByLabel(label: string, category?: VaultCategory): Promise<{ id: string; category: VaultCategory }[]> {
  const worker = getCryptoWorker();
  const labelBlindBytes = await worker.blindIndex(label);
  const res = await fetch("/api/vault/items/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ labelBlind: b64(labelBlindBytes), category }),
  });
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  const { items } = await res.json() as { items: { id: string; category: VaultCategory }[] };
  return items;
}
