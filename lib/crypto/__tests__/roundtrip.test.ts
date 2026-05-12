import { describe, it, expect } from "vitest";
import {
  generateSalt,
  deriveKEK,
  generateMasterKey,
  wrapKey,
  unwrapKey,
  deriveSubKey,
  encryptBytes,
  decryptBytes,
  encryptStream,
  decryptStream,
  generateMnemonic,
  mnemonicToMasterKey,
  validateMnemonic,
  wrapForRecipient,
  unwrapFromSender,
  deriveX25519FromMK,
  blindIndex,
  normalize,
  decode,
  MAGIC,
  VERSION,
  INFO,
} from "../index";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

async function streamFromBytes(bytes: Uint8Array): Promise<ReadableStream<Uint8Array>> {
  return new ReadableStream({
    start(c) { c.enqueue(bytes); c.close(); },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    chunks.push(r.value);
  }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

describe("envelope", () => {
  it("encodes magic + version", async () => {
    const k = await generateMasterKey();
    const env = await encryptBytes(k, enc("hello"));
    expect(env.bytes[0]).toBe(MAGIC[0]);
    expect(env.bytes[4]).toBe(VERSION);
    const parsed = decode(env.bytes);
    expect(parsed.version).toBe(VERSION);
    expect(parsed.nonce.length).toBe(24);
  });

  it("rejects bad magic", () => {
    const buf = new Uint8Array(50);
    expect(() => decode(buf)).toThrow();
  });
});

describe("kdf + wrap", () => {
  it("derives KEK and round-trips MK wrap", async () => {
    const salt = await generateSalt();
    const kek = await deriveKEK("correct horse battery staple", salt);
    const mk = await generateMasterKey();
    const wrapped = await wrapKey(mk, kek);
    const unwrapped = await unwrapKey(wrapped.bytes, kek);
    expect(unwrapped).toEqual(mk);
  });

  it("wrong passphrase fails", async () => {
    const salt = await generateSalt();
    const kek = await deriveKEK("right", salt);
    const mk = await generateMasterKey();
    const wrapped = await wrapKey(mk, kek);
    const bad = await deriveKEK("wrong", salt);
    await expect(unwrapKey(wrapped.bytes, bad)).rejects.toBeTruthy();
  });
}, 60_000);

describe("aead", () => {
  it("round-trips bytes", async () => {
    const k = await generateMasterKey();
    const env = await encryptBytes(k, enc("the quick brown fox"));
    const pt = await decryptBytes(k, env.bytes);
    expect(dec(pt)).toBe("the quick brown fox");
  });

  it("tampered ciphertext fails", async () => {
    const k = await generateMasterKey();
    const env = await encryptBytes(k, enc("payload"));
    env.bytes[env.bytes.length - 1] ^= 0xff;
    await expect(decryptBytes(k, env.bytes)).rejects.toBeTruthy();
  });
});

describe("subkey derivation", () => {
  it("deterministic per info", async () => {
    const mk = await generateMasterKey();
    const a = await deriveSubKey(mk, INFO.DB);
    const b = await deriveSubKey(mk, INFO.DB);
    const c = await deriveSubKey(mk, INFO.FILES);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("stream aead", () => {
  it("round-trips multi-chunk stream", async () => {
    const k = await generateMasterKey();
    const data = new Uint8Array(200_000);
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff;
    const ct = await encryptStream(k, await streamFromBytes(data), 32_768);
    const pt = await decryptStream(k, ct);
    const out = await readAll(pt);
    expect(out.length).toBe(data.length);
    expect(out).toEqual(data);
  });

  it("round-trips empty stream", async () => {
    const k = await generateMasterKey();
    const ct = await encryptStream(k, await streamFromBytes(new Uint8Array(0)));
    const pt = await decryptStream(k, ct);
    const out = await readAll(pt);
    expect(out.length).toBe(0);
  });
});

describe("mnemonic", () => {
  it("generates 24 words and round-trips to MK", async () => {
    const m = generateMnemonic();
    expect(m.split(/\s+/).length).toBe(24);
    expect(validateMnemonic(m)).toBe(true);
    const mk1 = await mnemonicToMasterKey(m);
    const mk2 = await mnemonicToMasterKey(m);
    expect(mk1.length).toBe(32);
    expect(mk1).toEqual(mk2);
  });

  it("rejects invalid mnemonic", async () => {
    expect(validateMnemonic("not a real mnemonic phrase")).toBe(false);
    await expect(mnemonicToMasterKey("not a real phrase")).rejects.toBeTruthy();
  });
});

describe("sharing (box_seal)", () => {
  it("recipient unwraps DEK", async () => {
    const mk = await generateMasterKey();
    const { pk, sk } = await deriveX25519FromMK(mk);
    const dek = await deriveSubKey(mk, INFO.FILES);
    const sealed = await wrapForRecipient(dek, pk);
    const opened = await unwrapFromSender(sealed, pk, sk);
    expect(opened).toEqual(dek);
  });
});

describe("blindIndex", () => {
  it("deterministic for same input", async () => {
    const mk = await generateMasterKey();
    const k = await deriveSubKey(mk, INFO.INDEX);
    const a = blindIndex(k, normalize("Passport"));
    const b = blindIndex(k, normalize("  passport "));
    expect(a).toEqual(b);
  });

  it("different inputs differ", async () => {
    const mk = await generateMasterKey();
    const k = await deriveSubKey(mk, INFO.INDEX);
    expect(blindIndex(k, "a")).not.toEqual(blindIndex(k, "b"));
  });
});
