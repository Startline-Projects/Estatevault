import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

// Deterministic search token. Server stores HMAC, can match exact lookup but cannot recover plaintext.
// Caller MUST normalize (lowercase, trim, NFC) before hashing.
export function blindIndex(indexKey: Uint8Array, normalized: string): Uint8Array {
  if (indexKey.length !== 32) throw new Error("bad index key length");
  const data = new TextEncoder().encode(normalized);
  return hmac(sha256, indexKey, data);
}

export function normalize(s: string): string {
  return s.normalize("NFC").trim().toLowerCase();
}
