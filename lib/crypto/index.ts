// @estatevault/crypto — public API. Mirrors Dart `estatevault_crypto` package.
// All functions are pure; no global key state. Caller manages MK lifecycle (Phase 2: Web Worker).

export * from "./envelope";
export { DEFAULT_KDF, SALT_LEN, KEY_LEN, deriveKEK, generateSalt } from "./kdf";
export type { KdfParams } from "./kdf";
export { encryptBytes, decryptBytes } from "./aead";
export { encryptStream, decryptStream, HEADER_LEN as STREAM_HEADER_LEN, DEFAULT_CHUNK } from "./streamAead";
export {
  MK_LEN,
  INFO,
  generateMasterKey,
  wrapKey,
  unwrapKey,
  deriveSubKey,
  deriveX25519FromMK,
  deriveEd25519FromMK,
  zero,
} from "./keyManager";
export { generateMnemonic, validateMnemonic, mnemonicToMasterKey } from "./mnemonic";
export { wrapForRecipient, unwrapFromSender } from "./sharing";
export { blindIndex, normalize } from "./blindIndex";
