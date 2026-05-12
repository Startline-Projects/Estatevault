import * as bip39 from "bip39";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";

// 24 words = 256 bits entropy.
const STRENGTH = 256;
// Per docs/CRYPTO_SPEC.md §3 — mnemonic seed → KEK_recovery via HKDF.
const INFO = "ev:kek:recovery:v1";

export function generateMnemonic(): string {
  return bip39.generateMnemonic(STRENGTH);
}

export function validateMnemonic(m: string): boolean {
  return bip39.validateMnemonic(m.trim().toLowerCase());
}

export async function mnemonicToMasterKey(mnemonic: string): Promise<Uint8Array> {
  const m = mnemonic.trim().toLowerCase();
  if (!bip39.validateMnemonic(m)) throw new Error("invalid mnemonic");
  // BIP39 seed (PBKDF2, 64B) → HKDF-SHA256 to 32B MK with our info string.
  const seed = await bip39.mnemonicToSeed(m, "");
  const ikm = new Uint8Array(seed.buffer, seed.byteOffset, seed.byteLength);
  return hkdf(sha256, ikm, new Uint8Array(0), new TextEncoder().encode(INFO), 32);
}
