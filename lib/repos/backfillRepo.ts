"use client";

// Browser-driven backfill. Fetches legacy rows in batches, encrypts each in
// the worker, posts back ciphertext. Server NULLs the plaintext columns same
// row, idempotent (WHERE ciphertext IS NULL guard). Rate-limited.

import { getCryptoWorker } from "@/lib/crypto/worker/client";
import { INFO } from "@/lib/crypto/keyManager";

type Table = "vault_items" | "vault_trustees" | "farewell_messages";
const BATCH = 50;

function b64(b: Uint8Array): string {
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

export type BackfillStatus = {
  bootstrapped: boolean;
  complete: boolean;
  completedAt: string | null;
  remaining: { vault_items: number; vault_trustees: number; farewell_messages: number };
  totalRemaining: number;
};

export async function getBackfillStatus(): Promise<BackfillStatus> {
  const res = await fetch("/api/vault/backfill/status");
  if (!res.ok) throw new Error(`status failed: ${res.status}`);
  return res.json();
}

async function fetchBatch(table: Table): Promise<Record<string, unknown>[]> {
  const res = await fetch(`/api/vault/backfill/fetch?table=${table}&limit=${BATCH}`);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const j = await res.json() as { rows: Record<string, unknown>[] };
  return j.rows;
}

async function encryptVaultItems(rows: Record<string, unknown>[]) {
  const worker = getCryptoWorker();
  const out = [];
  for (const r of rows) {
    const label = String(r.label ?? "");
    const data = (r.data as Record<string, unknown>) ?? {};
    const env = await worker.encryptBytes(
      new TextEncoder().encode(JSON.stringify({ label, data })),
      INFO.DB,
    );
    const labelBlind = label ? await worker.blindIndex(label) : null;
    out.push({
      id: r.id as string,
      ciphertext: b64(env.envelope),
      nonce: b64(env.nonce),
      encVersion: 1,
      labelBlind: labelBlind ? b64(labelBlind) : undefined,
    });
  }
  return out;
}

async function encryptTrustees(rows: Record<string, unknown>[]) {
  const worker = getCryptoWorker();
  const out = [];
  for (const r of rows) {
    const meta = JSON.stringify({
      name: r.trustee_name ?? "",
      email: r.trustee_email ?? "",
      relationship: r.trustee_relationship ?? "",
    });
    const env = await worker.encryptBytes(new TextEncoder().encode(meta), INFO.DB);
    const email = String(r.trustee_email ?? "").trim().toLowerCase();
    const emailBlind = email ? await worker.blindIndex(email) : null;
    out.push({
      id: r.id as string,
      ciphertext: b64(env.envelope),
      nonce: b64(env.nonce),
      encVersion: 1,
      emailBlind: emailBlind ? b64(emailBlind) : undefined,
    });
  }
  return out;
}

async function encryptFarewell(rows: Record<string, unknown>[]) {
  const worker = getCryptoWorker();
  const out = [];
  for (const r of rows) {
    const meta = JSON.stringify({
      title: r.title ?? "",
      recipient_email: r.recipient_email ?? "",
    });
    const env = await worker.encryptBytes(new TextEncoder().encode(meta), INFO.DB);
    const email = String(r.recipient_email ?? "").trim().toLowerCase();
    const blind = email ? await worker.blindIndex(email) : null;
    out.push({
      id: r.id as string,
      ciphertext: b64(env.envelope),
      nonce: b64(env.nonce),
      encVersion: 1,
      recipientBlind: blind ? b64(blind) : undefined,
    });
  }
  return out;
}

async function postBatch(table: Table, encrypted: unknown[]) {
  const res = await fetch("/api/vault/backfill/encrypt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, rows: encrypted }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `encrypt failed: ${res.status}`);
  }
  return res.json() as Promise<{ updated: string[]; failed: { id: string; error: string }[] }>;
}

export type BackfillProgress = {
  table: Table;
  remaining: number;
  updatedThisBatch: number;
  failedThisBatch: number;
};

export async function runBackfill(opts?: {
  onProgress?: (p: BackfillProgress) => void;
  abortSignal?: AbortSignal;
}): Promise<BackfillStatus> {
  const tables: Table[] = ["vault_items", "vault_trustees", "farewell_messages"];

  for (const table of tables) {
    while (!opts?.abortSignal?.aborted) {
      const rows = await fetchBatch(table);
      if (rows.length === 0) break;

      let encrypted: unknown[] = [];
      if (table === "vault_items") encrypted = await encryptVaultItems(rows);
      else if (table === "vault_trustees") encrypted = await encryptTrustees(rows);
      else encrypted = await encryptFarewell(rows);

      const result = await postBatch(table, encrypted);

      opts?.onProgress?.({
        table,
        remaining: rows.length, // batch size, not global
        updatedThisBatch: result.updated.length,
        failedThisBatch: result.failed.length,
      });

      // If nothing succeeded, stop to avoid infinite loop on poisoned row.
      if (result.updated.length === 0) break;
      // Yield to event loop between batches.
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  return getBackfillStatus();
}
