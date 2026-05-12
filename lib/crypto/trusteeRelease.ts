/**
 * Server-side encryption of Shamir Share C under TRUSTEE_RELEASE_KEY.
 *
 * Share C plain is generated owner-side at trustee setup and posted to the
 * server. Server MUST NOT store it plain — only release it after admin
 * approval + 72h owner-veto window. We wrap it with a server-held symmetric
 * key (env var, ideally injected by a separate vendor's secret store —
 * Vercel/CF env distinct from Supabase).
 *
 * Node-only. Do not import from worker/browser code.
 */

import sodium from "libsodium-wrappers-sumo";

let ready = false;
async function ensureSodium() {
  if (!ready) {
    await sodium.ready;
    ready = true;
  }
}

function loadKey(): Uint8Array {
  const b64 = process.env.TRUSTEE_RELEASE_KEY;
  if (!b64) throw new Error("TRUSTEE_RELEASE_KEY env missing");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("TRUSTEE_RELEASE_KEY must be 32-byte base64");
  return new Uint8Array(key);
}

const NONCE_LEN = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES ?? 24;

/**
 * Encrypt: [nonce(24)][ciphertext+tag]
 */
export async function encryptShareC(plain: Uint8Array): Promise<Uint8Array> {
  await ensureSodium();
  const key = loadKey();
  const nonce = sodium.randombytes_buf(NONCE_LEN);
  const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plain, null, null, nonce, key);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return out;
}

export async function decryptShareC(blob: Uint8Array): Promise<Uint8Array> {
  await ensureSodium();
  const key = loadKey();
  if (blob.length < NONCE_LEN + 16) throw new Error("share C blob too short");
  const nonce = blob.slice(0, NONCE_LEN);
  const ct = blob.slice(NONCE_LEN);
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, null, nonce, key);
}
