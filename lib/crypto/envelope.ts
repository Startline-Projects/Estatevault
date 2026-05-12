// EV01 envelope: magic(4) | version(1) | nonce(24) | ciphertext+tag
// Single source of truth for on-disk format. Mobile parity required.

export const MAGIC = new Uint8Array([0x45, 0x56, 0x30, 0x31]); // "EV01"
export const VERSION = 1;
export const NONCE_LEN = 24; // XChaCha20
export const HEADER_LEN = MAGIC.length + 1 + NONCE_LEN; // 29
export const TAG_LEN = 16; // Poly1305

export type Envelope = {
  bytes: Uint8Array; // full encoded envelope
  nonce: Uint8Array; // 24B
  ciphertext: Uint8Array; // ct||tag
  version: number;
};

export function encode(nonce: Uint8Array, ciphertext: Uint8Array): Envelope {
  if (nonce.length !== NONCE_LEN) throw new Error("bad nonce length");
  const out = new Uint8Array(HEADER_LEN + ciphertext.length);
  out.set(MAGIC, 0);
  out[MAGIC.length] = VERSION;
  out.set(nonce, MAGIC.length + 1);
  out.set(ciphertext, HEADER_LEN);
  return { bytes: out, nonce, ciphertext, version: VERSION };
}

export function decode(buf: Uint8Array): Envelope {
  if (buf.length < HEADER_LEN + TAG_LEN) throw new Error("envelope too short");
  for (let i = 0; i < MAGIC.length; i++) {
    if (buf[i] !== MAGIC[i]) throw new Error("bad magic");
  }
  const version = buf[MAGIC.length];
  if (version !== VERSION) throw new Error(`unsupported enc_version=${version}`);
  const nonce = buf.slice(MAGIC.length + 1, HEADER_LEN);
  const ciphertext = buf.slice(HEADER_LEN);
  return { bytes: buf, nonce, ciphertext, version };
}

export function validate(buf: Uint8Array): boolean {
  try { decode(buf); return true; } catch { return false; }
}
