/**
 * Shamir Secret Sharing — 2-of-3 split for trustee vault access.
 *
 * Pieces:
 *   A = server (Supabase profiles.vault_master_share_a)
 *   B = derived from owner mnemonic (deterministic, never stored)
 *   C = ephemeral, generated at admin approval, emailed to trustee
 *
 * Implementation: GF(256) Shamir over 32-byte secrets. Each byte split
 * independently with degree-(threshold-1) polynomial. Pure libsodium for
 * randomness and constant-time ops where possible.
 */

import { getSodium } from "./sodium";

export const SHARE_INDEX_A = 1;
export const SHARE_INDEX_B = 2;
export const SHARE_INDEX_C = 3;

export const MASTER_KEY_LEN = 32;
export const THRESHOLD = 2;
export const TOTAL_SHARES = 3;

// GF(256) tables — AES Rijndael field, irreducible poly 0x11b.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initTables() {
  // Generator 0x03 (primitive in GF(256) under Rijndael poly 0x11b).
  let v = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = v;
    LOG[v] = i;
    const dbl = ((v << 1) ^ (v & 0x80 ? 0x1b : 0)) & 0xff;
    v = dbl ^ v; // v * 3 in GF(256)
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  LOG[0] = 0;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error("gf division by zero");
  if (a === 0) return 0;
  return EXP[(LOG[a] + 255 - LOG[b]) % 255];
}

/**
 * Evaluate polynomial coeffs[0] + coeffs[1]*x + ... at x in GF(256).
 * Horner's method.
 */
function gfEval(coeffs: Uint8Array, x: number): number {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = gfMul(result, x) ^ coeffs[i];
  }
  return result;
}

export interface Share {
  index: number;       // x-coordinate, 1..255
  value: Uint8Array;   // y-coordinates per byte of secret
}

/**
 * Split 32-byte secret into N shares, threshold T.
 * Generates random coefficients per byte using libsodium CSPRNG.
 */
export async function splitSecret(
  secret: Uint8Array,
  threshold: number = THRESHOLD,
  total: number = TOTAL_SHARES,
): Promise<Share[]> {
  if (secret.length !== MASTER_KEY_LEN) throw new Error("secret must be 32 bytes");
  if (threshold < 2 || threshold > total) throw new Error("bad threshold");
  if (total > 255) throw new Error("max 255 shares");

  const s = await getSodium();
  const shares: Share[] = [];

  // Per-byte polynomials. coeff[0] = secret byte; coeff[1..t-1] = random.
  const polys: Uint8Array[] = [];
  for (let b = 0; b < secret.length; b++) {
    const coeffs = new Uint8Array(threshold);
    coeffs[0] = secret[b];
    const rand = s.randombytes_buf(threshold - 1);
    for (let i = 1; i < threshold; i++) coeffs[i] = rand[i - 1];
    polys.push(coeffs);
  }

  for (let i = 1; i <= total; i++) {
    const value = new Uint8Array(secret.length);
    for (let b = 0; b < secret.length; b++) {
      value[b] = gfEval(polys[b], i);
    }
    shares.push({ index: i, value });
  }
  return shares;
}

/**
 * Combine threshold shares to reconstruct the secret.
 * Lagrange interpolation at x=0.
 */
export function combineShares(shares: Share[]): Uint8Array {
  if (shares.length < 2) throw new Error("need at least 2 shares");
  const len = shares[0].value.length;
  for (const sh of shares) {
    if (sh.value.length !== len) throw new Error("share length mismatch");
    if (sh.index < 1 || sh.index > 255) throw new Error("bad share index");
  }

  const secret = new Uint8Array(len);
  for (let b = 0; b < len; b++) {
    let acc = 0;
    for (let i = 0; i < shares.length; i++) {
      let num = 1;
      let den = 1;
      for (let j = 0; j < shares.length; j++) {
        if (i === j) continue;
        num = gfMul(num, shares[j].index);
        den = gfMul(den, shares[i].index ^ shares[j].index);
      }
      const lagrange = gfDiv(num, den);
      acc ^= gfMul(shares[i].value[b], lagrange);
    }
    secret[b] = acc;
  }
  return secret;
}

/**
 * Encode a share as bytes for storage/transport.
 * Layout: [index:1][value:32]  (33 bytes total for 32-byte secret)
 */
export function encodeShare(share: Share): Uint8Array {
  const out = new Uint8Array(1 + share.value.length);
  out[0] = share.index;
  out.set(share.value, 1);
  return out;
}

export function decodeShare(buf: Uint8Array): Share {
  if (buf.length < 2) throw new Error("share too short");
  return { index: buf[0], value: buf.slice(1) };
}

/**
 * Derive Share B deterministically from owner mnemonic seed.
 * Uses HKDF-style: BLAKE2b(seed, "ev-shamir-share-b-v1") truncated to 32 bytes,
 * then prefixed with index byte 2. Deterministic so owner can always
 * recompute Share B from their mnemonic without server help.
 *
 * NOTE: Share B is NOT a free choice — Shamir requires it to lie on the
 * polynomial. So instead, we GENERATE the polynomial such that the evaluation
 * at x=SHARE_INDEX_B equals the mnemonic-derived value. See setupShamir below.
 */
export async function deriveShareBValue(mnemonicSeed: Uint8Array): Promise<Uint8Array> {
  const s = await getSodium();
  const ctx = new TextEncoder().encode("ev-shamir-share-b-v1");
  // BLAKE2b keyed with seed, personalised with context
  const combined = new Uint8Array(mnemonicSeed.length + ctx.length);
  combined.set(mnemonicSeed, 0);
  combined.set(ctx, mnemonicSeed.length);
  return s.crypto_generichash(MASTER_KEY_LEN, combined, null);
}

/**
 * Setup 2-of-3 split with Share B pinned to mnemonic-derived value.
 *
 * Constraint: Shamir poly P of degree 1 (threshold 2) over GF(256) per byte.
 * Two points fully determine P: (SHARE_INDEX_A, A_val) and (SHARE_INDEX_B, B_val).
 * We pick A_val randomly per byte, set B_val from mnemonic, solve for the
 * secret P(0) and Share C = P(SHARE_INDEX_C).
 *
 * Returns: { masterKey, shareA, shareB, shareC }
 * Caller stores shareA on server, discards masterKey + shareC (regenerated later),
 * and shareB is implicit in the mnemonic (don't store).
 */
export async function setupShamirFromMnemonic(
  mnemonicSeed: Uint8Array,
): Promise<{
  masterKey: Uint8Array;
  shareA: Share;
  shareB: Share;
  shareC: Share;
}> {
  const s = await getSodium();
  const bVal = await deriveShareBValue(mnemonicSeed);
  const aVal = s.randombytes_buf(MASTER_KEY_LEN);

  // Threshold 2 → P(x) = m + k*x (per byte). Two unknowns: m (secret), k.
  //   P(A_idx) = m + k*A_idx = aVal[b]
  //   P(B_idx) = m + k*B_idx = bVal[b]
  // Solve: k = (aVal - bVal) / (A_idx - B_idx); m = aVal - k*A_idx
  const secret = new Uint8Array(MASTER_KEY_LEN);
  const cVal = new Uint8Array(MASTER_KEY_LEN);
  const dx = SHARE_INDEX_A ^ SHARE_INDEX_B; // GF subtraction = XOR
  for (let b = 0; b < MASTER_KEY_LEN; b++) {
    const k = gfDiv(aVal[b] ^ bVal[b], dx);
    const m = aVal[b] ^ gfMul(k, SHARE_INDEX_A);
    secret[b] = m;
    // C value = m + k * C_idx
    cVal[b] = m ^ gfMul(k, SHARE_INDEX_C);
  }

  return {
    masterKey: secret,
    shareA: { index: SHARE_INDEX_A, value: aVal },
    shareB: { index: SHARE_INDEX_B, value: bVal },
    shareC: { index: SHARE_INDEX_C, value: cVal },
  };
}
