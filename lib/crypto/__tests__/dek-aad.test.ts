import { describe, it, expect } from "vitest";
import { generateMasterKey, wrapKey, unwrapKey } from "../keyManager";

// C-2: the DEK wrap must be bound to client identity via AAD so a wrapped blob
// copied onto another client's row cannot be unwrapped under that client's id.
const aad = (clientId: string) => new TextEncoder().encode(`dek:${clientId}`);

describe("DEK AAD binding (C-2)", () => {
  it("unwraps with the same client AAD it was wrapped with", async () => {
    const kek = await generateMasterKey();
    const dek = await generateMasterKey();
    const env = await wrapKey(dek, kek, aad("client-A"));

    const out = await unwrapKey(env.bytes, kek, aad("client-A"));
    expect(out).toEqual(dek);
  });

  it("fails to unwrap when the blob is moved to a different client (B)", async () => {
    const kek = await generateMasterKey();
    const dek = await generateMasterKey();
    const env = await wrapKey(dek, kek, aad("client-A"));

    // Attacker copies A's wrapped_dek onto B's row; B's session unwraps with B's id.
    await expect(unwrapKey(env.bytes, kek, aad("client-B"))).rejects.toThrow();
  });

  it("a legacy no-aad blob still unwraps without aad (back-compat)", async () => {
    const kek = await generateMasterKey();
    const dek = await generateMasterKey();
    const legacy = await wrapKey(dek, kek); // no aad

    const out = await unwrapKey(legacy.bytes, kek);
    expect(out).toEqual(dek);
    // and the same legacy blob must NOT unwrap when aad is required
    await expect(unwrapKey(legacy.bytes, kek, aad("client-A"))).rejects.toThrow();
  });
});
