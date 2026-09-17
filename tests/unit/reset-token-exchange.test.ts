/**
 * POST /api/auth/exchange-reset-token — what the emailed reset link calls.
 *
 * Two things were wrong with it. It was unreachable for a signed-out person
 * (covered by public-api-allowlist.test.ts). And it marked the link as used
 * BEFORE asking Supabase to verify it, so a transient verification failure
 * burned a perfectly good link: the person's next click was told the link had
 * "already been used", and they had to start again.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  claim: vi.fn(),
  isClaimed: vi.fn(),
  rateLimit: vi.fn(),
  order: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      verifyOtp: (...a: unknown[]) => { h.order.push("verifyOtp"); return h.verifyOtp(...a); },
    },
  }),
}));
vi.mock("@/lib/auth/resetTokenStore", () => ({
  claimResetToken: (...a: unknown[]) => { h.order.push("claim"); return h.claim(...a); },
  isResetTokenClaimed: (...a: unknown[]) => { h.order.push("isClaimed"); return h.isClaimed(...a); },
}));
vi.mock("@/lib/rate-limit", () => ({
  authIpRateLimit: { limit: (...a: unknown[]) => h.rateLimit(...a) },
  clientIp: () => "203.0.113.7",
}));

async function exchange(body: unknown) {
  const { POST } = await import("@/app/api/auth/exchange-reset-token/route");
  const res = await POST(new Request("http://localhost/api/auth/exchange-reset-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never);
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.order.length = 0;
  h.rateLimit.mockResolvedValue({ success: true });
  h.verifyOtp.mockResolvedValue({ error: null });
  h.claim.mockResolvedValue(true);
  h.isClaimed.mockResolvedValue(false);
});

describe("a good link", () => {
  it("is verified first and marked used only afterwards", async () => {
    const r = await exchange({ token_hash: "good-token" });
    expect(r).toEqual({ status: 200, body: { success: true } });
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: "good-token", type: "recovery" });
    expect(h.claim).toHaveBeenCalledWith("good-token");
    expect(h.order).toEqual(["verifyOtp", "claim"]);
  });
});

describe("a link that fails to verify", () => {
  const REFUSED = { error: { name: "AuthApiError", status: 403, message: "Token has expired or is invalid" } };
  const UNAVAILABLE = { error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" } };

  it("is NOT marked used", async () => {
    h.verifyOtp.mockResolvedValue(REFUSED);
    const r = await exchange({ token_hash: "bad-token" });
    expect(r).toEqual({ status: 400, body: { error: "invalid_or_expired_link" } });
    expect(h.claim).not.toHaveBeenCalled();
  });

  it.each([
    ["Supabase unreachable", UNAVAILABLE],
    ["Supabase 500", { error: { name: "AuthApiError", status: 500, message: "upstream" } }],
    ["gateway timeout", { error: { name: "AuthApiError", status: 504, message: "timeout" } }],
  ])("%s is a 503 'try again', not a dead link — and it burns nothing", async (_label, failure) => {
    h.verifyOtp.mockResolvedValue(failure);
    const r = await exchange({ token_hash: "good-token" });
    expect(r.status).toBe(503);
    expect(r.body.error).not.toBe("invalid_or_expired_link");
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.isClaimed).not.toHaveBeenCalled();
  });

  it("and the same link works on the next try", async () => {
    h.verifyOtp.mockResolvedValueOnce(UNAVAILABLE);
    expect((await exchange({ token_hash: "good-token" })).status).toBe(503);
    expect((await exchange({ token_hash: "good-token" })).status).toBe(200);
    expect(h.claim).toHaveBeenCalledTimes(1);
  });

  it("says 'already used' only when it really was", async () => {
    h.verifyOtp.mockResolvedValue(REFUSED);
    h.isClaimed.mockResolvedValue(true);
    const r = await exchange({ token_hash: "spent-token" });
    expect(r).toEqual({ status: 410, body: { error: "link_already_used" } });
    expect(h.claim).not.toHaveBeenCalled();
  });
});

describe("the used-link record is bookkeeping, never a reason to fail", () => {
  // By the time the claim is written, Supabase has consumed the one-time token
  // and set the session cookies. A store outage at that moment must not turn a
  // reset that worked into a 500 the page reports as a dead link.
  it("a store failure AFTER a successful verification still answers 200", async () => {
    h.claim.mockRejectedValue(new Error("upstash: fetch failed"));
    const r = await exchange({ token_hash: "good-token" });
    expect(r).toEqual({ status: 200, body: { success: true } });
    expect(h.verifyOtp).toHaveBeenCalledTimes(1);
  });

  it("a store failure while choosing the error message falls back to the generic one", async () => {
    h.verifyOtp.mockResolvedValue({ error: { name: "AuthApiError", status: 403, message: "Token has expired or is invalid" } });
    h.isClaimed.mockRejectedValue(new Error("upstash: fetch failed"));
    const r = await exchange({ token_hash: "some-token" });
    expect(r).toEqual({ status: 400, body: { error: "invalid_or_expired_link" } });
  });
});

describe("it is public, so it is limited and validated", () => {
  it("answers 429 by source before doing anything else", async () => {
    h.rateLimit.mockResolvedValue({ success: false });
    const r = await exchange({ token_hash: "good-token" });
    expect(r.status).toBe(429);
    expect(h.rateLimit).toHaveBeenCalledWith("reset-exchange:203.0.113.7");
    expect(h.verifyOtp).not.toHaveBeenCalled();
    expect(h.claim).not.toHaveBeenCalled();
  });

  it("rejects a body with no token", async () => {
    expect((await exchange({})).status).toBe(400);
    expect((await exchange({ token_hash: "" })).status).toBe(400);
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });
});
