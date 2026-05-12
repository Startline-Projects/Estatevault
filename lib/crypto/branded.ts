// Compile-time branded types for key material. Prevents passing a raw
// Uint8Array where the API expects an MK or DEK and vice versa.
//
// Usage:
//   const mk: MK = (await generateMasterKey()) as MK;
//   const dek: DEK = (await deriveSubKey(mk, INFO.DB)) as DEK;
//
// Branded types do not change runtime behavior — they are erased at build.

export type MK = Uint8Array & { readonly __brand: "MK" };
export type DEK = Uint8Array & { readonly __brand: "DEK" };
export type KEK = Uint8Array & { readonly __brand: "KEK" };
export type X25519Pub = Uint8Array & { readonly __brand: "X25519Pub" };
export type X25519Sec = Uint8Array & { readonly __brand: "X25519Sec" };
export type Ed25519Pub = Uint8Array & { readonly __brand: "Ed25519Pub" };
export type Ed25519Sec = Uint8Array & { readonly __brand: "Ed25519Sec" };

export function asMK(b: Uint8Array): MK { return b as MK; }
export function asDEK(b: Uint8Array): DEK { return b as DEK; }
export function asKEK(b: Uint8Array): KEK { return b as KEK; }

// Detect accidental key logging by lint rule (banned names below).
// Do not pass any of these to console.* anywhere outside test files.
declare global {
  interface Console {
    /** @deprecated Use never. Banned via ESLint no-restricted-syntax for key types. */
    logKey?: never;
  }
}
