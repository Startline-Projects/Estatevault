import { getSodium } from "./sodium";

// Argon2id params. Floor enforced — never downgrade.
export type KdfParams = {
  alg: "argon2id";
  m: number; // memory in KiB
  t: number; // ops
  p: number; // parallelism (libsodium = 1)
  v: number; // schema version
};

export const DEFAULT_KDF: KdfParams = {
  alg: "argon2id",
  m: 65536, // 64 MiB
  t: 3,
  p: 1,
  v: 1,
};

export const SALT_LEN = 16;
export const KEY_LEN = 32;

export async function generateSalt(): Promise<Uint8Array> {
  const s = await getSodium();
  return s.randombytes_buf(SALT_LEN);
}

export async function deriveKEK(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams = DEFAULT_KDF,
): Promise<Uint8Array> {
  if (params.alg !== "argon2id") throw new Error("unsupported kdf");
  if (params.m < 65536 || params.t < 3) throw new Error("kdf params below floor");
  if (salt.length !== SALT_LEN) throw new Error("bad salt length");

  const s = await getSodium();
  return s.crypto_pwhash(
    KEY_LEN,
    passphrase,
    salt,
    params.t,
    params.m * 1024, // libsodium expects bytes
    s.crypto_pwhash_ALG_ARGON2ID13,
  );
}
