"use client";

// Client-side repo for crypto API. Encodes binary as base64 over the wire.
// All Uint8Array material in/out lives in the worker; only encoded blobs cross the network.

import type { KdfParams } from "@/lib/crypto/kdf";

function b64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type BootstrapPayload = {
  salt: Uint8Array;
  kdfParams: KdfParams;
  wrappedMkPass: Uint8Array;
  wrappedMkRecovery: Uint8Array;
  pubX25519: Uint8Array;
  pubEd25519: Uint8Array;
};

export async function postBootstrap(p: BootstrapPayload): Promise<void> {
  const res = await fetch("/api/crypto/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      salt: b64(p.salt),
      kdfParams: p.kdfParams,
      wrappedMkPass: b64(p.wrappedMkPass),
      wrappedMkRecovery: b64(p.wrappedMkRecovery),
      pubX25519: b64(p.pubX25519),
      pubEd25519: b64(p.pubEd25519),
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `bootstrap failed: ${res.status}`);
  }
}

export async function getBundle(): Promise<{
  salt: Uint8Array;
  kdfParams: KdfParams;
  wrappedMkPass: Uint8Array;
  encVersion: number;
}> {
  const res = await fetch("/api/crypto/bundle");
  if (!res.ok) throw new Error(`bundle failed: ${res.status}`);
  const j = await res.json();
  return {
    salt: fromB64(j.salt),
    kdfParams: j.kdfParams,
    wrappedMkPass: fromB64(j.wrappedMkPass),
    encVersion: j.encVersion,
  };
}

export async function getRecoveryBundle(): Promise<{
  wrappedMkRecovery: Uint8Array;
  encVersion: number;
}> {
  const res = await fetch("/api/crypto/recovery-bundle");
  if (!res.ok) throw new Error(`recovery bundle failed: ${res.status}`);
  const j = await res.json();
  return {
    wrappedMkRecovery: fromB64(j.wrappedMkRecovery),
    encVersion: j.encVersion,
  };
}

export async function postRotatePassphrase(p: {
  salt: Uint8Array;
  kdfParams: KdfParams;
  wrappedMkPass: Uint8Array;
}): Promise<void> {
  const res = await fetch("/api/crypto/rotate-passphrase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      salt: b64(p.salt),
      kdfParams: p.kdfParams,
      wrappedMkPass: b64(p.wrappedMkPass),
    }),
  });
  if (!res.ok) throw new Error(`rotate failed: ${res.status}`);
}

export async function getShamirStatus(): Promise<{
  initialized: boolean;
  initializedAt: string | null;
  version: number | null;
}> {
  const res = await fetch("/api/crypto/shamir-setup");
  if (!res.ok) throw new Error(`shamir status failed: ${res.status}`);
  return res.json();
}

export async function postShamirSetup(p: {
  shareA: Uint8Array;
  shareC: Uint8Array;
  wrappedMkShamir: Uint8Array;
  shamirVersion: number;
}): Promise<void> {
  const res = await fetch("/api/crypto/shamir-setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shareA: b64(p.shareA),
      shareC: b64(p.shareC),
      wrappedMkShamir: b64(p.wrappedMkShamir),
      shamirVersion: p.shamirVersion,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `shamir setup failed: ${res.status}`);
  }
}

export async function getRecipientPubkey(opts: { email?: string; userId?: string }) {
  const q = new URLSearchParams();
  if (opts.email) q.set("email", opts.email);
  if (opts.userId) q.set("userId", opts.userId);
  const res = await fetch(`/api/crypto/pubkey?${q}`);
  if (!res.ok) throw new Error(`pubkey lookup failed: ${res.status}`);
  const j = await res.json();
  return { userId: j.userId as string, pubX25519: fromB64(j.pubX25519), encVersion: j.encVersion as number };
}
