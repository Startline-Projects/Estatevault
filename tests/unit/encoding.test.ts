import { describe, it, expect } from "vitest";
import {
  b64encode,
  b64decode,
  byteaToBytes,
  bytesToBytea,
} from "@/lib/crypto/encoding";

describe("b64encode / b64decode roundtrip", () => {
  it("encodes and decodes empty array", () => {
    const empty = new Uint8Array(0);
    expect(b64decode(b64encode(empty))).toEqual(empty);
  });

  it("encodes and decodes single byte", () => {
    const one = new Uint8Array([0xff]);
    expect(b64decode(b64encode(one))).toEqual(one);
  });

  it("encodes and decodes multi-byte data", () => {
    const data = new Uint8Array([0, 1, 2, 128, 255]);
    expect(b64decode(b64encode(data))).toEqual(data);
  });

  it("encodes known value to expected base64", () => {
    const abc = new TextEncoder().encode("abc");
    expect(b64encode(abc)).toBe("YWJj");
  });

  it("decodes known base64 to expected bytes", () => {
    const result = b64decode("YWJj");
    expect(new TextDecoder().decode(result)).toBe("abc");
  });

  it("handles binary data with null bytes", () => {
    const data = new Uint8Array([0, 0, 0, 1, 0, 0]);
    expect(b64decode(b64encode(data))).toEqual(data);
  });
});

describe("byteaToBytes", () => {
  it("returns empty Uint8Array for null", () => {
    expect(byteaToBytes(null)).toEqual(new Uint8Array());
  });

  it("returns empty Uint8Array for undefined", () => {
    expect(byteaToBytes(undefined)).toEqual(new Uint8Array());
  });

  it("passes through Uint8Array unchanged", () => {
    const data = new Uint8Array([1, 2, 3]);
    expect(byteaToBytes(data)).toBe(data);
  });

  it("decodes \\x hex prefix (lowercase)", () => {
    const result = byteaToBytes("\\x48656c6c6f");
    expect(new TextDecoder().decode(result)).toBe("Hello");
  });

  it("decodes \\X hex prefix (uppercase)", () => {
    const result = byteaToBytes("\\X48656c6c6f");
    expect(new TextDecoder().decode(result)).toBe("Hello");
  });

  it("falls back to base64 for plain strings", () => {
    const result = byteaToBytes("YWJj");
    expect(new TextDecoder().decode(result)).toBe("abc");
  });

  it("handles number arrays", () => {
    expect(byteaToBytes([1, 2, 3])).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("handles JSON-serialized Buffer objects", () => {
    const bufferLike = { type: "Buffer", data: [72, 101, 108, 108, 111] };
    const result = byteaToBytes(bufferLike);
    expect(new TextDecoder().decode(result)).toBe("Hello");
  });

  it("throws on unrecognized types", () => {
    expect(() => byteaToBytes(12345)).toThrow("unrecognized bytea value");
  });
});

describe("bytesToBytea", () => {
  it("encodes empty array", () => {
    expect(bytesToBytea(new Uint8Array())).toBe("\\x");
  });

  it("encodes known bytes to hex", () => {
    expect(bytesToBytea(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]))).toBe("\\x48656c6c6f");
  });

  it("pads single-digit hex values", () => {
    expect(bytesToBytea(new Uint8Array([0x01, 0x0a]))).toBe("\\x010a");
  });

  it("roundtrips with byteaToBytes", () => {
    const data = new Uint8Array([0, 128, 255, 1, 42]);
    expect(byteaToBytes(bytesToBytea(data))).toEqual(data);
  });
});
