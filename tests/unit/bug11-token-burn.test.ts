import { describe, it, expect } from "vitest";
import {
  storeCode,
  verifyCode,
  peekVerifiedToken,
  consumeVerifiedToken,
} from "@/lib/auth/emailVerification";

// BUG-11: the verified-email token must NOT be burned until set-password
// actually succeeds. peek validates without consuming; consume is single-use.
describe("BUG-11 — verified token is not burned on a failed attempt", () => {
  async function issueToken(email: string): Promise<string> {
    await storeCode(email, "123456");
    const res = await verifyCode(email, "123456");
    if (!res.ok) throw new Error("setup: verifyCode failed");
    return res.token;
  }

  it("peek validates the token but does NOT consume it", async () => {
    const email = "peek@test.com";
    const token = await issueToken(email);

    // Gate check runs first — and can run again on a retry — both true.
    expect(await peekVerifiedToken(email, token)).toBe(true);
    expect(await peekVerifiedToken(email, token)).toBe(true);
  });

  it("simulated failure path leaves the token usable for retry, success then burns it", async () => {
    const email = "retry@test.com";
    const token = await issueToken(email);

    // Attempt 1: gate peeks OK, then the work fails (e.g. createUser down) →
    // we never reach consume. Token must survive.
    expect(await peekVerifiedToken(email, token)).toBe(true);
    // ...createUser throws, route returns 500, NO consume...

    // Attempt 2 (retry): gate still passes because token wasn't burned.
    expect(await peekVerifiedToken(email, token)).toBe(true);

    // Work succeeds → consume burns it (single-use).
    expect(await consumeVerifiedToken(email, token)).toBe(true);
    // Now the token is gone — a replay is rejected.
    expect(await consumeVerifiedToken(email, token)).toBe(false);
    expect(await peekVerifiedToken(email, token)).toBe(false);
  });

  it("rejects a wrong token", async () => {
    const email = "wrong@test.com";
    await issueToken(email);
    expect(await peekVerifiedToken(email, "not-the-token")).toBe(false);
  });
});
