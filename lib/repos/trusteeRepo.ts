"use client";

// Trustee repo. Persists ciphertext (name + email + relationship). Email is
// also sent over the wire transiently for invite delivery only — server uses
// it once for Resend, never persists.

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

export type TrusteePlaintext = {
  id: string;
  name: string;
  email: string;
  relationship: string;
  status: string;
  encrypted: boolean;
  invite_sent_at: string | null;
  confirmed_at: string | null;
};

type RawRow = {
  id: string;
  trustee_name: string | null;
  trustee_email: string | null;
  trustee_relationship: string | null;
  ciphertext: string | Uint8Array | null;
  nonce: string | Uint8Array | null;
  enc_version: number | null;
  email_blind: string | Uint8Array | null;
  status: string;
  invite_sent_at: string | null;
  confirmed_at: string | null;
};

export async function listTrustees(): Promise<TrusteePlaintext[]> {
  const res = await fetch("/api/vault/trustees");
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  const { trustees } = await res.json() as { trustees: RawRow[] };
  const worker = getCryptoWorker();

  const out: TrusteePlaintext[] = [];
  for (const r of trustees) {
    const ct = decodeBytea(r.ciphertext);
    if (ct) {
      try {
        const pt = await worker.decryptBytes(ct, INFO.DB);
        const parsed = JSON.parse(new TextDecoder().decode(pt)) as {
          name: string; email: string; relationship: string;
        };
        out.push({
          id: r.id,
          name: parsed.name, email: parsed.email, relationship: parsed.relationship,
          status: r.status,
          encrypted: true,
          invite_sent_at: r.invite_sent_at, confirmed_at: r.confirmed_at,
        });
      } catch {
        out.push({
          id: r.id, name: "[decryption failed]", email: "", relationship: "",
          status: r.status, encrypted: true,
          invite_sent_at: r.invite_sent_at, confirmed_at: r.confirmed_at,
        });
      }
    } else {
      out.push({
        id: r.id,
        name: r.trustee_name ?? "",
        email: r.trustee_email ?? "",
        relationship: r.trustee_relationship ?? "",
        status: r.status,
        encrypted: false,
        invite_sent_at: r.invite_sent_at, confirmed_at: r.confirmed_at,
      });
    }
  }
  return out;
}

export type AddTrusteeArgs = {
  name: string;
  email: string;
  relationship: string;
};

export async function addTrustee(args: AddTrusteeArgs): Promise<void> {
  const worker = getCryptoWorker();
  const meta = JSON.stringify({
    name: args.name,
    email: args.email,
    relationship: args.relationship,
  });
  const env = await worker.encryptBytes(new TextEncoder().encode(meta), INFO.DB);
  const emailBlind = await worker.blindIndex(args.email.trim().toLowerCase());

  const res = await fetch("/api/vault/trustees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ciphertext: b64(env.envelope),
      nonce: b64(env.nonce),
      emailBlind: b64(emailBlind),
      encVersion: 1,
      // Transient — server uses for invite email send, does NOT persist.
      invite_email: args.email,
      invite_name: args.name,
    }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    if (res.status === 409 && j.action === "setup_shamir") {
      const err = new Error(j.message ?? "Trustee access not initialized") as Error & { action?: string };
      err.action = "setup_shamir";
      throw err;
    }
    throw new Error(j.error ?? `add trustee failed: ${res.status}`);
  }
}

export async function deleteTrustee(id: string): Promise<void> {
  const res = await fetch(`/api/vault/trustees?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete trustee failed: ${res.status}`);
}
