// C-8 fix verification for app/api/checkout/attorney/verify.
//
// This file was first written against the BROKEN route — every "bug" test
// asserted what the buggy code did. After the C-8 fix landed (rename to
// profile_id, multiply fees by 100, drop stripe_session_id +
// years_in_practice, rename practice_area → practice_areas[], normalize tier,
// check the upsert error), the assertions were flipped to the CORRECT
// behavior. Both phases were observed green, proving the fix changed exactly
// what was intended and nothing else.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks (hoisted) -------------------------------------------------------
// vi.mock() is hoisted above ALL other code, so any variable a factory closes
// over must also be hoisted — that's what vi.hoisted() is for.

const { stripeRetrieve, adminCreateUser, profileUpsertSpy, partnerUpsertSpy } = vi.hoisted(() => ({
  stripeRetrieve: vi.fn(),
  adminCreateUser: vi.fn(),
  profileUpsertSpy: vi.fn(),
  partnerUpsertSpy: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { retrieve: stripeRetrieve } } },
}));

vi.mock("resend", () => ({
  Resend: class { emails = { send: vi.fn().mockResolvedValue({ error: null }) }; },
}));

vi.mock("@/lib/api/auth", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: adminCreateUser } },
  }),
}));

vi.mock("@/lib/repos/server/profileRepo", () => ({
  upsert: (...args: unknown[]) => profileUpsertSpy(...args),
}));
vi.mock("@/lib/repos/server/partnerRepo", () => ({
  upsert: (...args: unknown[]) => partnerUpsertSpy(...args),
}));

// Route imports the mocks above.
import { POST } from "@/app/api/checkout/attorney/verify/route";

// ---- Helpers ---------------------------------------------------------------

function makeSessionMeta(overrides: { metadata?: Record<string, unknown> } & Record<string, unknown> = {}) {
  const { metadata: metaOverride, ...rest } = overrides;
  return {
    id: "cs_test_1",
    payment_status: "paid",
    metadata: {
      flow: "attorney_signup",
      tier: "professional",
      bar_number: "P12345",
      review_fee: "300",
      firm_name: "Acme Law",
      practice_area: "estate",
      years_in_practice: "5",
      first_name: "Jane",
      last_name: "Doe",
      phone: "555-0100",
      ...(metaOverride ?? {}),
    },
    customer_email: "jane@example.com",
    amount_total: 600000, // $6,000 paid in cents
    ...rest,
  };
}

async function callPost(body: Record<string, unknown> = { session_id: "cs_test_1", password: "Test12345!" }) {
  const req = new Request("https://ev.test/api/checkout/attorney/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req as never);
}

// ---- Tests -----------------------------------------------------------------

describe("attorney/verify — C-8 fix verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeRetrieve.mockResolvedValue(makeSessionMeta());
    adminCreateUser.mockResolvedValue({
      data: { user: { id: "user-abc-123" } },
      error: null,
    });
    profileUpsertSpy.mockResolvedValue({ error: null });
    partnerUpsertSpy.mockResolvedValue({ error: null });
  });

  it("writes `profile_id` (not `user_id`) on the partners row", async () => {
    await callPost();
    const row = partnerUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row).toHaveProperty("profile_id", "user-abc-123");
    expect(row).not.toHaveProperty("user_id");
  });

  it("writes review_fee converted from dollars to cents", async () => {
    await callPost();
    const row = partnerUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    // meta.review_fee = "300" (dollars) → 30000 cents.
    expect(row.custom_review_fee).toBe(30000);
  });

  it("writes one_time_fee_amount as the raw Stripe cents (no dollar conversion)", async () => {
    await callPost();
    const row = partnerUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    // session.amount_total = 600000 → 600000 cents, not 6000 dollars.
    expect(row.one_time_fee_amount).toBe(600000);
  });

  it("writes `practice_areas` (text[]) instead of singular `practice_area`", async () => {
    await callPost();
    const row = partnerUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row).toHaveProperty("practice_areas");
    expect(row.practice_areas).toEqual(["estate"]);
    expect(row).not.toHaveProperty("practice_area");
  });

  it("omits the non-existent columns `years_in_practice` and `stripe_session_id`", async () => {
    await callPost();
    const row = partnerUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row).not.toHaveProperty("years_in_practice");
    expect(row).not.toHaveProperty("stripe_session_id");
  });

  it("normalizes tier 'professional' to 'enterprise' (satisfies the DB CHECK)", async () => {
    await callPost();
    const row = partnerUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row.tier).toBe("enterprise");
  });

  it("normalizes any other tier value to 'standard'", async () => {
    stripeRetrieve.mockResolvedValue(makeSessionMeta({ metadata: { tier: "basic" } }));
    await callPost();
    const row = partnerUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row.tier).toBe("standard");
  });

  it("returns 500 (not 200) when the partners upsert errors — no silent failure", async () => {
    partnerUpsertSpy.mockResolvedValue({ error: { message: "column not found" } });
    const res = await callPost();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: "Failed to create partner record." });
  });

  // Sibling C-8 fix: profiles table has only `full_name`, not first/last_name.
  // Route now joins names client-side and checks the upsert error.
  it("writes `full_name` (not first_name/last_name) on the profile row", async () => {
    await callPost();
    const row = profileUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row).toHaveProperty("full_name", "Jane Doe");
    expect(row).not.toHaveProperty("first_name");
    expect(row).not.toHaveProperty("last_name");
  });

  it("returns 500 when profiles upsert errors — no silent failure", async () => {
    profileUpsertSpy.mockResolvedValue({ error: { message: "column not found" } });
    const res = await callPost();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: "Failed to create profile." });
  });
});

// ---- Sanity checks (independent of the bug) --------------------------------

describe("attorney/verify — request-level guards (should NOT regress)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeRetrieve.mockResolvedValue(makeSessionMeta());
    adminCreateUser.mockResolvedValue({ data: { user: { id: "user-abc-123" } }, error: null });
  });

  it("rejects when session_id is missing", async () => {
    const res = await callPost({});
    expect(res.status).toBe(400);
  });

  it("rejects when the Stripe session is not paid", async () => {
    stripeRetrieve.mockResolvedValue(makeSessionMeta({ payment_status: "unpaid" }));
    const res = await callPost();
    expect(res.status).toBe(400);
  });

  it("rejects sessions whose metadata.flow is not attorney_signup", async () => {
    stripeRetrieve.mockResolvedValue(makeSessionMeta({ metadata: { flow: "other" } }));
    const res = await callPost();
    expect(res.status).toBe(400);
  });
});
