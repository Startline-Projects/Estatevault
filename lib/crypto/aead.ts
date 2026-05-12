import { getSodium } from "./sodium";
import { encode, decode, NONCE_LEN, type Envelope } from "./envelope";

export const KEY_LEN = 32;

export async function encryptBytes(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array | null = null,
): Promise<Envelope> {
  if (key.length !== KEY_LEN) throw new Error("bad key length");
  const s = await getSodium();
  const nonce = s.randombytes_buf(NONCE_LEN);
  // Normalize realm — jsdom's Uint8Array is not recognized by libsodium WASM bridge.
  const pt = new Uint8Array(plaintext);
  const ad = aad ? new Uint8Array(aad) : null;
  const ct = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    pt,
    ad,
    null,
    nonce,
    key,
  );
  return encode(nonce, ct);
}

export async function decryptBytes(
  key: Uint8Array,
  envelope: Uint8Array | Envelope,
  aad: Uint8Array | null = null,
): Promise<Uint8Array> {
  if (key.length !== KEY_LEN) throw new Error("bad key length");
  const env = envelope instanceof Uint8Array ? decode(envelope) : envelope;
  const s = await getSodium();
  const ad = aad ? new Uint8Array(aad) : null;
  return s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    new Uint8Array(env.ciphertext),
    ad,
    new Uint8Array(env.nonce),
    new Uint8Array(key),
  );
}
