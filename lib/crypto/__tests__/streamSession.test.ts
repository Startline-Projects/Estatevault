import { describe, it, expect } from "vitest";
import { createCryptoWorkerApi } from "../worker/api";
import { INFO } from "../index";

describe("worker stream session", () => {
  it("encrypt + decrypt 3-chunk stream", async () => {
    const api = createCryptoWorkerApi();
    await api.bootstrap({ passphrase: "pp" });

    const e = await api.beginEncryptStream(INFO.FILES);

    const c1 = new Uint8Array([1, 2, 3]);
    const c2 = new Uint8Array([4, 5, 6, 7]);
    const c3 = new Uint8Array([8, 9]);

    const e1 = await api.pushEncryptStream(e.sessionId, c1, false);
    const e2 = await api.pushEncryptStream(e.sessionId, c2, false);
    const e3 = await api.pushEncryptStream(e.sessionId, c3, true);

    const d = await api.beginDecryptStream(INFO.FILES, e.header);
    const r1 = await api.pullDecryptStream(d.sessionId, e1);
    const r2 = await api.pullDecryptStream(d.sessionId, e2);
    const r3 = await api.pullDecryptStream(d.sessionId, e3);

    expect(r1.plaintext).toEqual(c1);
    expect(r2.plaintext).toEqual(c2);
    expect(r3.plaintext).toEqual(c3);
    expect(r3.final).toBe(true);
  }, 30_000);

  it("rejects ops on locked vault", async () => {
    const api = createCryptoWorkerApi();
    await expect(api.beginEncryptStream(INFO.FILES)).rejects.toThrow(/locked/);
  });

  it("endStream clears session", async () => {
    const api = createCryptoWorkerApi();
    await api.bootstrap({ passphrase: "pp" });
    const e = await api.beginEncryptStream(INFO.FILES);
    await api.endStream(e.sessionId);
    await expect(api.pushEncryptStream(e.sessionId, new Uint8Array([1]), true))
      .rejects.toThrow(/unknown encrypt session/);
  }, 30_000);
});
