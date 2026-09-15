/**
 * Negative tests: no route may change an existing account's credentials
 * without proof that the caller controls the mailbox.
 *
 * Written during the audit verification pass. The last case failed when it was
 * written — the free-promo checkout branch reset the password of any account
 * whose address an anonymous caller typed in — and passes now that the branch
 * creates accounts but never touches existing ones.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { peekVerifiedToken, updateUserById, findIdByEmail, adminCreateUser, rateLimit } =
  vi.hoisted(() => ({
    peekVerifiedToken: vi.fn(),
    updateUserById: vi.fn(),
    findIdByEmail: vi.fn(),
    adminCreateUser: vi.fn(),
    rateLimit: vi.fn(),
  }));

vi.mock("@/lib/auth/emailVerification", () => ({
  peekVerifiedToken,
  consumeVerifiedToken: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/rate-limit", () => ({
  authRateLimit: { limit: rateLimit },
  authIpRateLimit: { limit: rateLimit },
  recoveryRateLimit: { limit: rateLimit },
  checkoutRateLimit: { limit: rateLimit },
  clientIp: () => "203.0.113.7",
}));

/**
 * A Supabase query builder that answers any method with itself and resolves to
 * a row when awaited. The routes under test chain a dozen different builder
 * methods; spelling each one out makes the test fail for the wrong reason.
 */
function chain(row: unknown = { id: "victim-profile-id" }, listRow: unknown = []): unknown {
  const target: Record<string | symbol, unknown> = {
    // awaiting the builder without single() yields a list
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: listRow, error: null }).then(resolve),
    single: () => Promise.resolve({ data: row, error: null }),
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      return () => chain(row, listRow);
    },
  });
}

vi.mock("@/lib/api/auth", () => ({
  createAdminClient: () => ({
    // `single`/`maybeSingle` want an object; a bare await wants a list.
    from: () => chain(),
    rpc: () => chain(null),
    auth: {
      admin: {
        createUser: adminCreateUser,
        updateUserById,
        getUserById: () =>
          Promise.resolve({ data: { user: { id: "victim-profile-id", email: "victim@example.com" } }, error: null }),
      },
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {}, get: () => undefined }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: () => chain(), auth: {} }) }));

vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_1", url: "https://stripe.test" }) } } },
}));

vi.mock("@/lib/repos/server/orderRepo", () => ({
  update: vi.fn().mockResolvedValue({ data: null, error: null }),
  insert: vi.fn().mockResolvedValue({ data: { id: "order-1" }, error: null }),
  create: vi.fn().mockResolvedValue({ data: { id: "order-1" }, error: null }),
}));

vi.mock("@/lib/repos/server/auditLogRepo", () => ({ insertEntry: vi.fn() }));
vi.mock("@/lib/repos/server/profileRepo", () => ({
  findIdByEmail,
  findIdByEmailMaybe: findIdByEmail,
  upsert: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendPasswordChangedEmail: vi.fn(),
  resolveSenderForEmail: vi.fn(),
  sendEmail: vi.fn(),
  renderEmailHeader: () => "",
  renderEmailFooter: () => "",
}));

const KNOWN_ACCOUNT = "victim@example.com";

function post(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ success: true });
  updateUserById.mockResolvedValue({ data: null, error: null });
  peekVerifiedToken.mockResolvedValue(false);
  findIdByEmail.mockResolvedValue({ data: { id: "victim-profile-id" } });
});

describe("POST /api/auth/set-password requires mailbox proof", () => {
  async function callSetPassword(body: Record<string, unknown>) {
    const { POST } = await import("@/app/api/auth/set-password/route");
    return POST(post("http://localhost/api/auth/set-password", body));
  }

  it("refuses an unauthenticated caller who knows only the account email", async () => {
    const res = await callSetPassword({ email: KNOWN_ACCOUNT, password: "attacker-chosen-pw" });
    expect(res.status).toBe(400); // schema requires verifiedToken
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses a forged verification token", async () => {
    const res = await callSetPassword({
      email: KNOWN_ACCOUNT,
      password: "attacker-chosen-pw",
      verifiedToken: "not-the-real-token",
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/verify your email/i) });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("checks the token against the email being changed, not some other email", async () => {
    peekVerifiedToken.mockResolvedValue(false);
    await callSetPassword({ email: KNOWN_ACCOUNT, password: "pw12345678", verifiedToken: "t" });
    expect(peekVerifiedToken).toHaveBeenCalledWith(KNOWN_ACCOUNT, "t");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("sets the password only once the token verifies", async () => {
    peekVerifiedToken.mockResolvedValue(true);
    const res = await callSetPassword({
      email: KNOWN_ACCOUNT,
      password: "pw12345678",
      verifiedToken: "the-real-token",
    });
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("victim-profile-id", { password: "pw12345678" });
  });

  it("is still refused when the rate limiter is exhausted", async () => {
    rateLimit.mockResolvedValue({ success: false });
    const res = await callSetPassword({ email: KNOWN_ACCOUNT, password: "pw12345678", verifiedToken: "t" });
    expect(res.status).toBe(429);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("limits by source address as well as by target email", async () => {
    peekVerifiedToken.mockResolvedValue(true);
    // per-email budget fine, source budget exhausted
    rateLimit.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
    const res = await callSetPassword({ email: KNOWN_ACCOUNT, password: "pw12345678", verifiedToken: "t" });
    expect(res.status).toBe(429);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("the free-promo checkout path must not touch an existing account's password", () => {
  it("does not reset the password of an account the caller merely named", async () => {
    const { createCheckoutSession } = await import("@/lib/checkout/createCheckoutSession");

    let threw: unknown = null;
    await createCheckoutSession(
      post("http://localhost/api/checkout/will", {}),
      { productType: "will", baseAmount: 40000, defaultEvCut: 10000, docTypes: ["will"],
        recommendation: "will", stripeName: "Will", stripeDescription: "", attorneyDescription: "",
        successPath: "/will/success", cancelPath: "/will/checkout" } as never,
      { userId: null, attorneyReview: false, intakeAnswers: { email: KNOWN_ACCOUNT },
        promoCode: "FREE134", email: KNOWN_ACCOUNT } as never,
    ).catch((e) => { threw = e; });

    // Guard against a false pass: if the call blew up before reaching the
    // promo branch, this test proves nothing. Surface that instead.
    expect(threw, `createCheckoutSession threw before the promo branch: ${threw}`).toBeNull();

    // No caller-supplied email should ever be enough to change a password.
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
