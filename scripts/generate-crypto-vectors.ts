#!/usr/bin/env tsx
/**
 * Populate docs/crypto-vectors.json expected_* fields from the web reference
 * implementation. Run AFTER any spec change. Mobile then re-runs its impl
 * against the same JSON; if both sides match, the parity contract holds.
 *
 *   npx tsx scripts/generate-crypto-vectors.ts            # write in place
 *   npx tsx scripts/generate-crypto-vectors.ts --check    # error if drift
 */
import fs from "node:fs";
import path from "node:path";
import sodium from "libsodium-wrappers-sumo";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";

const VECTORS_PATH = path.resolve(__dirname, "../docs/crypto-vectors.json");

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

const MAGIC = "45563031"; // "EV01"

async function main() {
  await sodium.ready;
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has("--check");

  const json = JSON.parse(fs.readFileSync(VECTORS_PATH, "utf8")) as Record<string, unknown>;
  let changed = false;

  // KDF (Argon2id)
  for (const t of (json.kdf as Array<Record<string, unknown>>) ?? []) {
    const params = t.params as { m: number; t: number; p: number; out: number };
    if (params.p !== 1) {
      console.warn(`[skip ${t.id}] libsodium crypto_pwhash forces p=1; vector requires p=${params.p}`);
      continue;
    }
    const out = sodium.crypto_pwhash(
      params.out,
      t.passphrase_utf8 as string,
      hexToBytes(t.salt_hex as string),
      params.t,
      params.m * 1024,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );
    const hex = bytesToHex(out);
    if (t.expected_kek_hex !== hex) {
      changed = true;
      t.expected_kek_hex = hex;
    }
  }

  // HKDF-SHA256
  for (const t of (json.hkdf as Array<Record<string, unknown>>) ?? []) {
    const ikm = hexToBytes(t.ikm_hex as string);
    const salt = hexToBytes(t.salt_hex as string);
    const info = new TextEncoder().encode(t.info_utf8 as string);
    const out = hkdf(sha256, ikm, salt, info, (t.len as number) ?? 32);
    const hex = bytesToHex(out);
    if (t.expected_okm_hex !== hex) {
      changed = true;
      t.expected_okm_hex = hex;
    }
  }

  // AEAD bytes (XChaCha20-Poly1305)
  for (const t of (json.aead_bytes as Array<Record<string, unknown>>) ?? []) {
    const key = hexToBytes(t.key_hex as string);
    const nonce = hexToBytes(t.nonce_hex as string);
    const pt = typeof t.plaintext_utf8 === "string"
      ? new TextEncoder().encode(t.plaintext_utf8)
      : hexToBytes((t.plaintext_hex ?? "") as string);
    const ad = t.ad_utf8 ? new TextEncoder().encode(t.ad_utf8 as string) : null;
    const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      new Uint8Array(pt), ad, null, new Uint8Array(nonce), new Uint8Array(key));
    const hex = bytesToHex(ct);
    if (t.expected_ciphertext_hex !== hex) { changed = true; t.expected_ciphertext_hex = hex; }
  }

  // Envelope
  for (const t of (json.envelope as Array<Record<string, unknown>>) ?? []) {
    const key = hexToBytes(t.key_hex as string);
    const nonce = hexToBytes(t.nonce_hex as string);
    const pt = typeof t.plaintext_utf8 === "string"
      ? new TextEncoder().encode(t.plaintext_utf8)
      : hexToBytes((t.plaintext_hex ?? "") as string);
    const ad = t.ad_utf8 ? new TextEncoder().encode(t.ad_utf8 as string) : null;
    const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      new Uint8Array(pt), ad, null, new Uint8Array(nonce), new Uint8Array(key));
    const env = MAGIC + "01" + bytesToHex(nonce) + bytesToHex(ct);
    if (t.expected_envelope_hex !== env) { changed = true; t.expected_envelope_hex = env; }
  }

  // Blind index — skip if key_hex itself is a placeholder (depends on hkdf)
  for (const t of (json.blind_index as Array<Record<string, unknown>>) ?? []) {
    if (typeof t.key_hex === "string" && t.key_hex.startsWith("<")) continue;
    const key = hexToBytes(t.key_hex as string);
    const data = new TextEncoder().encode(t.normalized_utf8 as string);
    const tag = hmac(sha256, key, data);
    const hex = bytesToHex(tag);
    if (t.expected_blind_hex !== hex) { changed = true; t.expected_blind_hex = hex; }
  }

  if (checkOnly) {
    if (changed) {
      console.error("crypto-vectors.json out of sync with reference impl. Run without --check to update.");
      process.exit(1);
    }
    console.log("crypto-vectors.json in sync.");
    return;
  }

  if (changed) {
    json.status = "Frozen — generated from web reference impl. Mobile must match byte-for-byte.";
    fs.writeFileSync(VECTORS_PATH, JSON.stringify(json, null, 2) + "\n", "utf8");
    console.log("Updated docs/crypto-vectors.json");
  } else {
    console.log("No changes.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
