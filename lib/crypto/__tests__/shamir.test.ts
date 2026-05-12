import { describe, it, expect } from "vitest";
import {
  splitSecret,
  combineShares,
  encodeShare,
  decodeShare,
  setupShamirFromMnemonic,
  deriveShareBValue,
  MASTER_KEY_LEN,
  SHARE_INDEX_A,
  SHARE_INDEX_B,
  SHARE_INDEX_C,
} from "../shamir";
import { getSodium } from "../sodium";

function randSecret(len = MASTER_KEY_LEN) {
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

describe("shamir 2-of-3", () => {
  it("splits and reconstructs from any 2 shares", async () => {
    const secret = randSecret();
    const shares = await splitSecret(secret, 2, 3);
    expect(shares.length).toBe(3);

    const pairs = [
      [shares[0], shares[1]],
      [shares[0], shares[2]],
      [shares[1], shares[2]],
    ];
    for (const pair of pairs) {
      const recovered = combineShares(pair);
      expect(Array.from(recovered)).toEqual(Array.from(secret));
    }
  });

  it("single share reveals nothing structural", async () => {
    const secret = new Uint8Array(MASTER_KEY_LEN);
    const shares = await splitSecret(secret, 2, 3);
    // Single share value is just a polynomial eval; non-zero in general.
    expect(shares[0].value.length).toBe(MASTER_KEY_LEN);
  });

  it("encode/decode share roundtrip", async () => {
    const secret = randSecret();
    const shares = await splitSecret(secret, 2, 3);
    const buf = encodeShare(shares[1]);
    const dec = decodeShare(buf);
    expect(dec.index).toBe(shares[1].index);
    expect(Array.from(dec.value)).toEqual(Array.from(shares[1].value));
  });

  it("setupShamirFromMnemonic produces consistent 2-of-3", async () => {
    await getSodium();
    const seed = new Uint8Array(32);
    for (let i = 0; i < 32; i++) seed[i] = i + 1;
    const { masterKey, shareA, shareB, shareC } = await setupShamirFromMnemonic(seed);

    expect(shareA.index).toBe(SHARE_INDEX_A);
    expect(shareB.index).toBe(SHARE_INDEX_B);
    expect(shareC.index).toBe(SHARE_INDEX_C);

    // Share B must equal deterministic derivation.
    const bDerived = await deriveShareBValue(seed);
    expect(Array.from(shareB.value)).toEqual(Array.from(bDerived));

    // Any 2 shares reconstruct masterKey.
    expect(Array.from(combineShares([shareA, shareB]))).toEqual(Array.from(masterKey));
    expect(Array.from(combineShares([shareA, shareC]))).toEqual(Array.from(masterKey));
    expect(Array.from(combineShares([shareB, shareC]))).toEqual(Array.from(masterKey));
  });

  it("deriveShareBValue is deterministic for same seed", async () => {
    const seed = new Uint8Array(32).fill(7);
    const a = await deriveShareBValue(seed);
    const b = await deriveShareBValue(seed);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
