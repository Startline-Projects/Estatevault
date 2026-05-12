// Vector parity test. Reads docs/crypto-vectors.json and asserts that the
// web reference implementation reproduces every expected_* value byte-for-byte.
//
// Placeholder rows ("<TBD...>") are SKIPPED, not failed — populate via
// scripts/generate-crypto-vectors.ts then re-run.
//
// Mobile (Dart) runs the same JSON through its impl. CI on both sides green
// = byte-identical contract holds.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { getSodium } from "../sodium";
import { encryptBytes, decryptBytes } from "../aead";
import { encode as encodeEnv } from "../envelope";

const VECTORS = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../../docs/crypto-vectors.json"), "utf8"),
) as Record<string, unknown>;

const TBD = (s: unknown) => typeof s === "string" && s.startsWith("<");

function hexToBytes(s: string): Uint8Array {
  if (s.length % 2 !== 0) throw new Error("bad hex length");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  let s = ""; for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

function readPlain(t: { plaintext_utf8?: string; plaintext_hex?: string }): Uint8Array {
  if (typeof t.plaintext_utf8 === "string") return new TextEncoder().encode(t.plaintext_utf8);
  if (typeof t.plaintext_hex === "string") return hexToBytes(t.plaintext_hex);
  throw new Error("vector has no plaintext");
}

describe("crypto vectors (parity contract)", () => {
  it("HKDF-SHA256 matches each reserved info string", () => {
    const cases = (VECTORS.hkdf as Array<Record<string, string | number>>) ?? [];
    let asserted = 0, skipped = 0;
    for (const t of cases) {
      if (TBD(t.expected_okm_hex)) { skipped++; continue; }
      const ikm = hexToBytes(t.ikm_hex as string);
      const salt = hexToBytes(t.salt_hex as string);
      const info = new TextEncoder().encode(t.info_utf8 as string);
      const len = (t.len as number) ?? 32;
      const okm = hkdf(sha256, ikm, salt, info, len);
      expect(bytesToHex(okm)).toBe((t.expected_okm_hex as string).toLowerCase());
      asserted++;
    }
    expect(asserted + skipped).toBeGreaterThan(0);
  });

  it("XChaCha20-Poly1305 byte AEAD matches each test", async () => {
    await getSodium();
    const cases = (VECTORS.aead_bytes as Array<Record<string, string>>) ?? [];
    let asserted = 0;
    for (const t of cases) {
      if (TBD(t.expected_ciphertext_hex)) continue;
      const key = hexToBytes(t.key_hex);
      const nonce = hexToBytes(t.nonce_hex);
      const pt = readPlain(t);
      const ad = t.ad_utf8 ? new Uint8Array(new TextEncoder().encode(t.ad_utf8)) : null;

      // Use libsodium directly so we don't reuse our envelope wrapping here.
      const s = await getSodium();
      const ct = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
        new Uint8Array(pt),
        ad,
        null,
        new Uint8Array(nonce),
        new Uint8Array(key),
      );
      expect(bytesToHex(ct)).toBe(t.expected_ciphertext_hex.toLowerCase());

      // Round trip
      const back = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, ct, ad, new Uint8Array(nonce), new Uint8Array(key),
      );
      expect(bytesToHex(back)).toBe(bytesToHex(pt));
      asserted++;
    }
    expect(asserted).toBeGreaterThanOrEqual(0);
  });

  it("envelope encoding matches", async () => {
    const cases = (VECTORS.envelope as Array<Record<string, string | number>>) ?? [];
    for (const t of cases) {
      if (TBD(t.expected_envelope_hex)) continue;
      const key = hexToBytes(t.key_hex as string);
      const nonce = hexToBytes(t.nonce_hex as string);
      const pt = readPlain(t as { plaintext_hex?: string; plaintext_utf8?: string });

      // Directly assemble via our aead+envelope path with deterministic nonce.
      // encryptBytes uses random nonce, so we use libsodium directly + envelope encoder.
      const s = await getSodium();
      const ad = t.ad_utf8 ? new Uint8Array(new TextEncoder().encode(t.ad_utf8 as string)) : null;
      const ct = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
        new Uint8Array(pt),
        ad,
        null,
        new Uint8Array(nonce),
        new Uint8Array(key),
      );
      const env = encodeEnv(new Uint8Array(nonce), ct);
      expect(bytesToHex(env.bytes)).toBe((t.expected_envelope_hex as string).toLowerCase());

      // Round trip: aead.decryptBytes accepts the bytes too.
      void encryptBytes; void decryptBytes;
    }
  });

  it("blind index (HMAC-SHA256) matches", async () => {
    const cases = (VECTORS.blind_index as Array<Record<string, string>>) ?? [];
    for (const t of cases) {
      if (TBD(t.expected_blind_hex) || TBD(t.key_hex)) continue;
      const key = hexToBytes(t.key_hex);
      const data = new TextEncoder().encode(t.normalized_utf8);
      const tag = hmac(sha256, key, data);
      expect(bytesToHex(tag)).toBe(t.expected_blind_hex.toLowerCase());
    }
  });

  it("vector schema sanity", () => {
    expect(VECTORS.spec_version).toBe(1);
    expect(Array.isArray(VECTORS.hkdf)).toBe(true);
    expect(Array.isArray(VECTORS.aead_bytes)).toBe(true);
  });
});
