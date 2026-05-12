// Worker API surface. MK lives only in worker. Main thread holds opaque handles.

import type { KdfParams } from "../kdf";

export type SubKeyHandle = string; // opaque ID returned to main thread
export type LockState = "locked" | "unlocked" | "uninitialized";

export type EncryptedBytes = {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  envelope: Uint8Array;
};

export type CryptoWorkerApi = {
  // Lifecycle
  ping(): Promise<"pong">;
  getState(): Promise<LockState>;
  lock(): Promise<void>;

  // Key bootstrap (signup)
  bootstrap(args: {
    passphrase: string;
    kdfParams?: KdfParams;
  }): Promise<{
    salt: Uint8Array;
    kdfParams: KdfParams;
    wrappedMkPass: Uint8Array;
    wrappedMkRecovery: Uint8Array;
    pubX25519: Uint8Array;
    pubEd25519: Uint8Array;
    mnemonic: string; // shown once, then cleared
  }>;

  // Unlock via passphrase bundle from server
  unlockWithPassphrase(args: {
    passphrase: string;
    salt: Uint8Array;
    kdfParams: KdfParams;
    wrappedMkPass: Uint8Array;
  }): Promise<void>;

  unlockWithMnemonic(args: {
    mnemonic: string;
    wrappedMkRecovery: Uint8Array;
  }): Promise<void>;

  // Operations (require unlocked)
  encryptBytes(plaintext: Uint8Array, info: string): Promise<EncryptedBytes>;
  decryptBytes(envelope: Uint8Array, info: string): Promise<Uint8Array>;

  // Streaming AEAD (secretstream). Session ID opaque to main thread.
  // Begin: returns header bytes to prepend to upload.
  // Push: returns ciphertext for one chunk; isFinal closes session.
  // Pull: feeds ciphertext, returns plaintext + finalFlag.
  beginEncryptStream(info: string): Promise<{ sessionId: string; header: Uint8Array }>;
  pushEncryptStream(sessionId: string, chunk: Uint8Array, isFinal: boolean): Promise<Uint8Array>;
  beginDecryptStream(info: string, header: Uint8Array): Promise<{ sessionId: string }>;
  pullDecryptStream(sessionId: string, ct: Uint8Array): Promise<{ plaintext: Uint8Array; final: boolean }>;
  endStream(sessionId: string): Promise<void>;
  blindIndex(normalized: string): Promise<Uint8Array>;
  publicKeys(): Promise<{ x25519: Uint8Array; ed25519: Uint8Array }>;
  wrapDekForRecipient(info: string, recipientPub: Uint8Array): Promise<Uint8Array>;
  unwrapDekFromSealed(sealed: Uint8Array): Promise<Uint8Array>;
  // Sharing decrypt — keeps DEK inside worker. Use instead of leaking DEK to
  // main thread + re-importing it.
  decryptSharedItem(sealed: Uint8Array, envelope: Uint8Array): Promise<Uint8Array>;
  // Open a server-sealed payload (PDF, etc.) using recipient X25519 keypair.
  openSealedBox(sealed: Uint8Array): Promise<Uint8Array>;

  // Rotation
  rewrapPassphraseFromUnlocked(args: {
    newPassphrase: string;
    newKdfParams?: KdfParams;
  }): Promise<{
    salt: Uint8Array;
    kdfParams: KdfParams;
    wrappedMkPass: Uint8Array;
  }>;

  // Trustee unlock — combine 2 shamir shares → master_key → unwrap MK.
  unlockWithShamir(args: {
    shareA: Uint8Array;             // encoded [index + value]
    shareC: Uint8Array;             // encoded [index + value]
    wrappedMkShamir: Uint8Array;    // MK envelope under master_key
  }): Promise<void>;

  // Trustee Shamir setup — Phase 2.
  // Owner unlocked + provides mnemonic → derives Share B, generates Share A,
  // wraps MK under reconstructed shamir master_key. Server stores Share A +
  // wrappedMkShamir. Share C generated later by server at admin approval.
  setupTrusteeShamir(args: { mnemonic: string }): Promise<{
    shareA: Uint8Array;             // encoded share (index + value) — server-plain
    shareC: Uint8Array;             // encoded share — server encrypts at rest with release key
    wrappedMkShamir: Uint8Array;    // MK wrapped under shamir master_key
    shamirVersion: number;
  }>;

  rewrapPassphrase(args: {
    oldPassphrase: string;
    oldSalt: Uint8Array;
    oldKdfParams: KdfParams;
    oldWrappedMkPass: Uint8Array;
    newPassphrase: string;
    newKdfParams?: KdfParams;
  }): Promise<{
    salt: Uint8Array;
    kdfParams: KdfParams;
    wrappedMkPass: Uint8Array;
  }>;
};
