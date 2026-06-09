import { describe, it, expect, vi, afterEach } from "vitest";
import { hasVaultAccess } from "@/lib/repos/server/clientRepo";

const DAY = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe("hasVaultAccess — BUG-5 (keep paid access until term end)", () => {
  it("active subscription always has access", () => {
    expect(hasVaultAccess("active", null)).toBe(true);
    expect(hasVaultAccess("active", new Date(Date.now() - DAY).toISOString())).toBe(true);
  });

  it("cancelled but not yet expired keeps access", () => {
    const future = new Date(Date.now() + 60 * DAY).toISOString();
    expect(hasVaultAccess("cancelled", future)).toBe(true);
  });

  it("cancelled and past expiry loses access", () => {
    const past = new Date(Date.now() - DAY).toISOString();
    expect(hasVaultAccess("cancelled", past)).toBe(false);
  });

  it("cancelled with no expiry has no access", () => {
    expect(hasVaultAccess("cancelled", null)).toBe(false);
  });

  it("none / past_due / unknown statuses have no access", () => {
    const future = new Date(Date.now() + 60 * DAY).toISOString();
    expect(hasVaultAccess("none", future)).toBe(false);
    expect(hasVaultAccess("past_due", future)).toBe(false);
    expect(hasVaultAccess(null, future)).toBe(false);
    expect(hasVaultAccess(undefined, undefined)).toBe(false);
  });
});
