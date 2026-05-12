import { describe, it, expect } from "vitest";
import { createCryptoWorkerApi } from "../worker/api";
import { decode, INFO } from "../index";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe("worker api lifecycle", () => {
  it("starts locked", async () => {
    const api = createCryptoWorkerApi();
    expect(await api.getState()).toBe("locked");
  });

  it("bootstrap → unlocked, returns wrapped material + mnemonic", async () => {
    const api = createCryptoWorkerApi();
    const out = await api.bootstrap({ passphrase: "correct horse battery staple" });
    expect(await api.getState()).toBe("unlocked");
    expect(out.salt.length).toBe(16);
    expect(out.kdfParams.alg).toBe("argon2id");
    expect(out.pubX25519.length).toBe(32);
    expect(out.pubEd25519.length).toBe(32);
    expect(out.mnemonic.split(/\s+/).length).toBe(24);
    expect(decode(out.wrappedMkPass).version).toBe(1);
    expect(decode(out.wrappedMkRecovery).version).toBe(1);
  }, 30_000);

  it("encrypt requires unlocked", async () => {
    const api = createCryptoWorkerApi();
    await expect(api.encryptBytes(enc("x"), INFO.DB)).rejects.toThrow(/locked/);
  });

  it("encrypt → decrypt round trip after unlock", async () => {
    const api = createCryptoWorkerApi();
    const boot = await api.bootstrap({ passphrase: "pp1" });
    const env = await api.encryptBytes(enc("secret payload"), INFO.DB);
    const pt = await api.decryptBytes(env.envelope, INFO.DB);
    expect(dec(pt)).toBe("secret payload");
    void boot;
  }, 30_000);

  it("lock clears keys", async () => {
    const api = createCryptoWorkerApi();
    await api.bootstrap({ passphrase: "pp1" });
    await api.lock();
    expect(await api.getState()).toBe("locked");
    await expect(api.encryptBytes(enc("x"), INFO.DB)).rejects.toThrow(/locked/);
  }, 30_000);

  it("unlock with passphrase using bundle", async () => {
    const a1 = createCryptoWorkerApi();
    const boot = await a1.bootstrap({ passphrase: "pp1" });
    const env = await a1.encryptBytes(enc("hello"), INFO.DB);
    await a1.lock();

    const a2 = createCryptoWorkerApi();
    await a2.unlockWithPassphrase({
      passphrase: "pp1",
      salt: boot.salt,
      kdfParams: boot.kdfParams,
      wrappedMkPass: boot.wrappedMkPass,
    });
    const pt = await a2.decryptBytes(env.envelope, INFO.DB);
    expect(dec(pt)).toBe("hello");
  }, 60_000);

  it("unlock with mnemonic recovers MK", async () => {
    const a1 = createCryptoWorkerApi();
    const boot = await a1.bootstrap({ passphrase: "pp1" });
    const env = await a1.encryptBytes(enc("recover-me"), INFO.DB);

    const a2 = createCryptoWorkerApi();
    await a2.unlockWithMnemonic({
      mnemonic: boot.mnemonic,
      wrappedMkRecovery: boot.wrappedMkRecovery,
    });
    const pt = await a2.decryptBytes(env.envelope, INFO.DB);
    expect(dec(pt)).toBe("recover-me");
  }, 60_000);

  it("rewrapPassphrase re-encrypts MK without changing it", async () => {
    const a1 = createCryptoWorkerApi();
    const boot = await a1.bootstrap({ passphrase: "old" });
    const env = await a1.encryptBytes(enc("payload"), INFO.DB);

    const rew = await a1.rewrapPassphrase({
      oldPassphrase: "old",
      oldSalt: boot.salt,
      oldKdfParams: boot.kdfParams,
      oldWrappedMkPass: boot.wrappedMkPass,
      newPassphrase: "new",
    });

    const a2 = createCryptoWorkerApi();
    await a2.unlockWithPassphrase({
      passphrase: "new",
      salt: rew.salt,
      kdfParams: rew.kdfParams,
      wrappedMkPass: rew.wrappedMkPass,
    });
    const pt = await a2.decryptBytes(env.envelope, INFO.DB);
    expect(dec(pt)).toBe("payload");
  }, 90_000);

  it("rewrapPassphraseFromUnlocked rotates wrap without old passphrase", async () => {
    const a1 = createCryptoWorkerApi();
    const boot = await a1.bootstrap({ passphrase: "old" });
    const env = await a1.encryptBytes(enc("payload"), INFO.DB);
    void boot;

    const rew = await a1.rewrapPassphraseFromUnlocked({ newPassphrase: "new" });

    const a2 = createCryptoWorkerApi();
    await a2.unlockWithPassphrase({
      passphrase: "new",
      salt: rew.salt,
      kdfParams: rew.kdfParams,
      wrappedMkPass: rew.wrappedMkPass,
    });
    const pt = await a2.decryptBytes(env.envelope, INFO.DB);
    expect(dec(pt)).toBe("payload");
  }, 60_000);

  it("share flow: wrap DEK to recipient pubkey, recipient unwraps", async () => {
    const sender = createCryptoWorkerApi();
    const recipient = createCryptoWorkerApi();
    await sender.bootstrap({ passphrase: "s" });
    await recipient.bootstrap({ passphrase: "r" });

    const recipPub = (await recipient.publicKeys()).x25519;
    const sealed = await sender.wrapDekForRecipient(INFO.FILES, recipPub);
    const dek = await recipient.unwrapDekFromSealed(sealed);
    expect(dek.length).toBeGreaterThan(0);
  }, 60_000);

  it("server seal → openSealedBox round-trip", async () => {
    const recipient = createCryptoWorkerApi();
    await recipient.bootstrap({ passphrase: "r" });
    const pub = (await recipient.publicKeys()).x25519;

    // Simulate server side using the same primitive (sealForRecipient uses libsodium).
    const { sealForRecipient } = await import("../../documents/seal");
    const sealed = await sealForRecipient(enc("PDF BYTES PRETEND"), pub);
    const pt = await recipient.openSealedBox(sealed);
    expect(dec(pt)).toBe("PDF BYTES PRETEND");
  }, 60_000);

  it("end-to-end share: sender encrypts item, recipient decrypts via sealed DEK", async () => {
    const sender = createCryptoWorkerApi();
    const recipient = createCryptoWorkerApi();
    await sender.bootstrap({ passphrase: "s" });
    await recipient.bootstrap({ passphrase: "r" });

    // Sender encrypts an item with FILES subkey.
    const env = await sender.encryptBytes(enc("shared payload"), INFO.FILES);

    // Sender wraps the FILES-DEK to the recipient pubkey.
    const recipPub = (await recipient.publicKeys()).x25519;
    const sealed = await sender.wrapDekForRecipient(INFO.FILES, recipPub);

    // Recipient opens sealed DEK + decrypts envelope inside the worker.
    const pt = await recipient.decryptSharedItem(sealed, env.envelope);
    expect(dec(pt)).toBe("shared payload");
  }, 60_000);
});
