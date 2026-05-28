// Unified binary ↔ text encoding helpers.
// Replaces 7 duplicated copies across lib/api/crypto, lib/crypto/keySession,
// lib/repos/{cryptoRepo,shareRepo,backfillRepo,videoRepo}, app/trustee/vault.

export function b64encode(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

export function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function byteaToBytes(v: unknown): Uint8Array {
  if (v == null) return new Uint8Array();
  if (v instanceof Uint8Array) return v;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(v)) return new Uint8Array(v);
  if (Array.isArray(v)) return new Uint8Array(v as number[]);
  if (typeof v === "string") {
    if (v.startsWith("\\x") || v.startsWith("\\X")) {
      const hex = v.slice(2);
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
      return out;
    }
    return b64decode(v);
  }
  if (typeof v === "object" && v !== null && "type" in v && (v as { type?: string }).type === "Buffer") {
    return new Uint8Array(((v as unknown) as { data: number[] }).data);
  }
  throw new Error("unrecognized bytea value");
}

export function bytesToBytea(b: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, "0");
  return "\\x" + hex;
}
