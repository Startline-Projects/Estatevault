/**
 * lib/auth/resetTokenStore — the real thing, not a mock.
 *
 * The exchange route's tests mock this module, so nothing else proves that the
 * reader added for the 410-vs-400 decision (isResetTokenClaimed) looks in the
 * same place the writer (claimResetToken) writes. No UPSTASH_* variables are
 * set under test, so this exercises the in-memory branch.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { claimResetToken, isResetTokenClaimed } from "@/lib/auth/resetTokenStore";

let n = 0;
let token = "";
beforeEach(() => {
  // The store is a process-wide Map; a fresh token per test keeps them independent.
  token = `reset-token-${Date.now()}-${n++}`;
});

describe("resetTokenStore", () => {
  it("an unclaimed link reads as unclaimed — and reading does not claim it", async () => {
    expect(await isResetTokenClaimed(token)).toBe(false);
    expect(await isResetTokenClaimed(token)).toBe(false);
    expect(await claimResetToken(token)).toBe(true);
  });

  it("a claimed link reads as claimed", async () => {
    expect(await claimResetToken(token)).toBe(true);
    expect(await isResetTokenClaimed(token)).toBe(true);
  });

  it("a link can be claimed once", async () => {
    expect(await claimResetToken(token)).toBe(true);
    expect(await claimResetToken(token)).toBe(false);
  });

  it("claiming one link says nothing about another", async () => {
    await claimResetToken(token);
    expect(await isResetTokenClaimed(`${token}-other`)).toBe(false);
  });
});
