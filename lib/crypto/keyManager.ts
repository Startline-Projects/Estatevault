import { getSodium } from "./sodium";
import { encryptBytes, decryptBytes } from "./aead";
import type { Envelope } from "./envelope";

export const MK_LEN = 32;

// HKDF info strings — MUST match docs/CRYPTO_SPEC.md (single source of truth
// for cross-platform parity). Mobile derives the same strings.
export const INFO = {
  DB: "ev:dek:db:v1",
  FILES: "ev:dek:files:v1",
  INDEX: "ev:idx:hmac:v1",
  X25519: "ev:key:x25519:v1",
  ED25519: "ev:key:ed25519:v1",
  AUDIT: "ev:audit:hmac:v1",
} as const;

export type SubKeyInfo = string;

export async function generateMasterKey(): Promise<Uint8Array> {
  const s = await getSodium();
  return s.randombytes_buf(MK_LEN);
}

export async function wrapKey(mk: Uint8Array, kek: Uint8Array): Promise<Envelope> {
  return encryptBytes(kek, mk);
}

export async function unwrapKey(envelope: Uint8Array | Envelope, kek: Uint8Array): Promise<Uint8Array> {
  return decryptBytes(kek, envelope);
}

// HKDF-SHA256 expand step (extract step = identity since MK already pseudorandom).
// Use libsodium kdf_derive_from_key as fast HKDF-equivalent? No — that is BLAKE2b based.
// For cross-platform parity (Dart sodium has same), use crypto_kdf_derive_from_key.
// Info string mapped to ctx (8 bytes) + subkey id. We use BLAKE2b of info string truncated to 8 bytes ctx
// and subkey_id derived from a hash of full info to ensure deterministic ID.
// Simpler: implement HKDF-SHA256 using @noble/hashes for cross-lib portability.
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

export async function deriveSubKey(mk: Uint8Array, info: SubKeyInfo, length = 32): Promise<Uint8Array> {
  if (mk.length !== MK_LEN) throw new Error("bad mk length");
  // HKDF(salt=empty, ikm=mk, info, length). MK is already 256-bit pseudorandom.
  return hkdf(sha256, mk, new Uint8Array(0), new TextEncoder().encode(info), length);
}

export async function deriveX25519FromMK(mk: Uint8Array): Promise<{ pk: Uint8Array; sk: Uint8Array }> {
  const s = await getSodium();
  const seed = await deriveSubKey(mk, INFO.X25519, 32);
  // X25519 keypair from seed: hash to clamp, then scalar mult.
  const sk = seed.slice(0, 32);
  const pk = s.crypto_scalarmult_base(sk);
  return { pk, sk };
}

export async function deriveEd25519FromMK(mk: Uint8Array): Promise<{ pk: Uint8Array; sk: Uint8Array }> {
  const s = await getSodium();
  const seed = await deriveSubKey(mk, INFO.ED25519, 32);
  const kp = s.crypto_sign_seed_keypair(seed);
  return { pk: kp.publicKey, sk: kp.privateKey };
}

export function zero(buf: Uint8Array): void {
  buf.fill(0);
}
