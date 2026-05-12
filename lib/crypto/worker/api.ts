// Worker API implementation — split from crypto.worker.ts so it is unit-testable
// without instantiating an actual Worker. The .worker.ts file just expose()s this.

import {
  DEFAULT_KDF,
  generateSalt,
  deriveKEK,
  generateMasterKey,
  wrapKey,
  unwrapKey,
  encryptBytes as aeadEncrypt,
  decryptBytes as aeadDecrypt,
  deriveSubKey,
  deriveX25519FromMK,
  deriveEd25519FromMK,
  generateMnemonic,
  mnemonicToMasterKey,
  blindIndex as bi,
  normalize,
  wrapForRecipient,
  unwrapFromSender,
  zero,
  INFO,
} from "../index";
import { getSodium } from "../sodium";
import { setupShamirFromMnemonic, encodeShare, decodeShare, combineShares } from "../shamir";
import type { CryptoWorkerApi, EncryptedBytes, LockState } from "./types";

const SHAMIR_VERSION = 1;

export function createCryptoWorkerApi(): CryptoWorkerApi {
  let state: LockState = "locked";
  let mk: Uint8Array | null = null;
  let indexKey: Uint8Array | null = null;
  let pubX: Uint8Array | null = null;
  let secX: Uint8Array | null = null;

  function requireUnlocked() {
    if (state !== "unlocked" || !mk) throw new Error("vault locked");
  }

  async function loadIdentity() {
    if (!mk) throw new Error("no MK");
    indexKey = await deriveSubKey(mk, INFO.INDEX);
    const x = await deriveX25519FromMK(mk);
    pubX = x.pk;
    secX = x.sk;
  }

  function clearKeys() {
    if (mk) zero(mk);
    if (indexKey) zero(indexKey);
    if (secX) zero(secX);
    mk = null; indexKey = null; pubX = null; secX = null;
    state = "locked";
  }

  type EncSession = { state: unknown; key: Uint8Array };
  type DecSession = { state: unknown; key: Uint8Array };
  const encSessions = new Map<string, EncSession>();
  const decSessions = new Map<string, DecSession>();
  const TAG_MESSAGE = 0;
  const TAG_FINAL = 3;

  function genSid(): string {
    return crypto.getRandomValues(new Uint8Array(16))
      .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
  }

  return {
    async ping() { return "pong"; },
    async getState() { return state; },
    async lock() { clearKeys(); },

    async bootstrap({ passphrase, kdfParams = DEFAULT_KDF }) {
      if (state === "unlocked") clearKeys();
      const salt = await generateSalt();
      const kek = await deriveKEK(passphrase, salt, kdfParams);
      const newMk = await generateMasterKey();
      const wrappedPass = await wrapKey(newMk, kek);

      const mnemonic = generateMnemonic();
      const recoveryKek = await mnemonicToMasterKey(mnemonic);
      const wrappedRec = await wrapKey(newMk, recoveryKek);

      mk = newMk;
      state = "unlocked";
      await loadIdentity();
      const ed = await deriveEd25519FromMK(mk);

      zero(kek);
      zero(recoveryKek);

      return {
        salt,
        kdfParams,
        wrappedMkPass: wrappedPass.bytes,
        wrappedMkRecovery: wrappedRec.bytes,
        pubX25519: pubX!,
        pubEd25519: ed.pk,
        mnemonic,
      };
    },

    async unlockWithPassphrase({ passphrase, salt, kdfParams, wrappedMkPass }) {
      if (state === "unlocked") clearKeys();
      const kek = await deriveKEK(passphrase, salt, kdfParams);
      try {
        mk = await unwrapKey(wrappedMkPass, kek);
      } finally { zero(kek); }
      state = "unlocked";
      await loadIdentity();
    },

    async unlockWithMnemonic({ mnemonic, wrappedMkRecovery }) {
      if (state === "unlocked") clearKeys();
      const kek = await mnemonicToMasterKey(mnemonic);
      try {
        mk = await unwrapKey(wrappedMkRecovery, kek);
      } finally { zero(kek); }
      state = "unlocked";
      await loadIdentity();
    },

    async encryptBytes(plaintext, info) {
      requireUnlocked();
      const dek = await deriveSubKey(mk!, info);
      try {
        const env = await aeadEncrypt(dek, plaintext);
        return { ciphertext: env.ciphertext, nonce: env.nonce, envelope: env.bytes } as EncryptedBytes;
      } finally { zero(dek); }
    },

    async decryptBytes(envelope, info) {
      requireUnlocked();
      const dek = await deriveSubKey(mk!, info);
      try {
        return await aeadDecrypt(dek, envelope);
      } finally { zero(dek); }
    },

    async beginEncryptStream(info) {
      requireUnlocked();
      const s = await getSodium();
      const key = await deriveSubKey(mk!, info);
      const init = s.crypto_secretstream_xchacha20poly1305_init_push(key);
      const sid = genSid();
      encSessions.set(sid, { state: init.state, key });
      return { sessionId: sid, header: init.header };
    },

    async pushEncryptStream(sessionId, chunk, isFinal) {
      requireUnlocked();
      const sess = encSessions.get(sessionId);
      if (!sess) throw new Error("unknown encrypt session");
      const s = await getSodium();
      const ct = s.crypto_secretstream_xchacha20poly1305_push(
        sess.state as never,
        new Uint8Array(chunk),
        null,
        isFinal ? TAG_FINAL : TAG_MESSAGE,
      );
      if (isFinal) {
        zero(sess.key);
        encSessions.delete(sessionId);
      }
      return ct;
    },

    async beginDecryptStream(info, header) {
      requireUnlocked();
      const s = await getSodium();
      const key = await deriveSubKey(mk!, info);
      const state = s.crypto_secretstream_xchacha20poly1305_init_pull(new Uint8Array(header), key);
      const sid = genSid();
      decSessions.set(sid, { state, key });
      return { sessionId: sid };
    },

    async pullDecryptStream(sessionId, ct) {
      requireUnlocked();
      const sess = decSessions.get(sessionId);
      if (!sess) throw new Error("unknown decrypt session");
      const s = await getSodium();
      const out = s.crypto_secretstream_xchacha20poly1305_pull(sess.state as never, new Uint8Array(ct), null);
      if (!out) throw new Error("decrypt failed");
      const final = out.tag === TAG_FINAL;
      if (final) {
        zero(sess.key);
        decSessions.delete(sessionId);
      }
      return { plaintext: out.message, final };
    },

    async endStream(sessionId) {
      const e = encSessions.get(sessionId);
      if (e) { zero(e.key); encSessions.delete(sessionId); }
      const d = decSessions.get(sessionId);
      if (d) { zero(d.key); decSessions.delete(sessionId); }
    },

    async blindIndex(input) {
      requireUnlocked();
      if (!indexKey) throw new Error("identity not loaded");
      return bi(indexKey, normalize(input));
    },

    async publicKeys() {
      requireUnlocked();
      const ed = await deriveEd25519FromMK(mk!);
      return { x25519: pubX!, ed25519: ed.pk };
    },

    async wrapDekForRecipient(info, recipientPub) {
      requireUnlocked();
      const dek = await deriveSubKey(mk!, info);
      try {
        return await wrapForRecipient(dek, recipientPub);
      } finally { zero(dek); }
    },

    async unwrapDekFromSealed(sealed) {
      requireUnlocked();
      if (!pubX || !secX) throw new Error("identity not loaded");
      return await unwrapFromSender(sealed, pubX, secX);
    },

    async openSealedBox(sealed) {
      requireUnlocked();
      if (!pubX || !secX) throw new Error("identity not loaded");
      return await unwrapFromSender(sealed, pubX, secX);
    },

    async decryptSharedItem(sealed, envelope) {
      requireUnlocked();
      if (!pubX || !secX) throw new Error("identity not loaded");
      const dek = await unwrapFromSender(sealed, pubX, secX);
      try {
        return await aeadDecrypt(dek, envelope);
      } finally {
        zero(dek);
      }
    },

    async rewrapPassphraseFromUnlocked({ newPassphrase, newKdfParams = DEFAULT_KDF }) {
      requireUnlocked();
      const newSalt = await generateSalt();
      const newKek = await deriveKEK(newPassphrase, newSalt, newKdfParams);
      const wrapped = await wrapKey(mk!, newKek);
      zero(newKek);
      return { salt: newSalt, kdfParams: newKdfParams, wrappedMkPass: wrapped.bytes };
    },

    async rewrapPassphrase({
      oldPassphrase, oldSalt, oldKdfParams, oldWrappedMkPass,
      newPassphrase, newKdfParams = DEFAULT_KDF,
    }) {
      const oldKek = await deriveKEK(oldPassphrase, oldSalt, oldKdfParams);
      let unwrapped: Uint8Array;
      try {
        unwrapped = await unwrapKey(oldWrappedMkPass, oldKek);
      } finally { zero(oldKek); }
      const newSalt = await generateSalt();
      const newKek = await deriveKEK(newPassphrase, newSalt, newKdfParams);
      const newWrapped = await wrapKey(unwrapped, newKek);
      zero(newKek);
      zero(unwrapped);
      return { salt: newSalt, kdfParams: newKdfParams, wrappedMkPass: newWrapped.bytes };
    },

    async unlockWithShamir({ shareA, shareC, wrappedMkShamir }) {
      if (state === "unlocked") clearKeys();
      const a = decodeShare(new Uint8Array(shareA));
      const c = decodeShare(new Uint8Array(shareC));
      const masterKey = combineShares([a, c]);
      try {
        mk = await unwrapKey(wrappedMkShamir, masterKey);
      } finally { zero(masterKey); zero(a.value); zero(c.value); }
      state = "unlocked";
      await loadIdentity();
    },

    async setupTrusteeShamir({ mnemonic }) {
      requireUnlocked();
      // Derive mnemonic seed (same path used for recovery KEK) — feeds Share B.
      const seed = await mnemonicToMasterKey(mnemonic);
      try {
        const { masterKey, shareA, shareB, shareC } = await setupShamirFromMnemonic(seed);
        // Wrap MK under shamir master_key. Server stores wrappedMkShamir.
        const wrapped = await wrapKey(mk!, masterKey);
        const encodedShareA = encodeShare(shareA);
        const encodedShareC = encodeShare(shareC);
        // Share B is mnemonic-derivable — never leaves worker.
        zero(masterKey);
        zero(shareB.value);
        zero(seed);
        return {
          shareA: encodedShareA,
          shareC: encodedShareC,
          wrappedMkShamir: wrapped.bytes,
          shamirVersion: SHAMIR_VERSION,
        };
      } catch (e) {
        zero(seed);
        throw e;
      }
    },
  };
}
