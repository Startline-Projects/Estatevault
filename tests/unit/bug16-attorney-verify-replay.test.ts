// BUG-16 — /api/checkout/attorney/verify is unauthenticated and replayable.
//
// The endpoint runs before the attorney has an account, keyed on a Stripe
// session_id that appears in the success URL, so it can be POSTed repeatedly.
// The fix makes it idempotent: resolve the account by email and run every
// mutation at most once. A replay must NOT
//   (a) write a body-supplied password onto an account that already exists, or
//   (b) reset an existing partner's admin-tuned tier/fee/status to signup values.
// These tests assert the CORRECT (post-fix) behavior.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mocks (hoisted) -------------------------------------------------------

const {
  stripeRetrieve,
  adminCreateUser,
  rpcMaybeSingle,
  profileUpsertSpy,
  partnerUpsertSpy,
  partnerGetByProfileId,
  resendSend,
} = vi.hoisted(() => ({
  stripeRetrieve: vi.fn(),
  adminCreateUser: vi.fn(),
  rpcMaybeSingle: vi.fn(),
  profileUpsertSpy: vi.fn(),
  partnerUpsertSpy: vi.fn(),
  partnerGetByProfileId: vi.fn(),
  resendSend: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { retrieve: stripeRetrieve } } },
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

vi.mock("@/lib/api/auth", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: adminCreateUser } },
    // Route resolves the auth user by email first:
    //   supabase.rpc(...).returns<...>().maybeSingle()
    rpc: () => ({ returns: () => ({ maybeSingle: () => rpcMaybeSingle() }) }),
  }),
}));

vi.mock("@/lib/repos/server/profileRepo", () => ({
  upsert: (...args: unknown[]) => profileUpsertSpy(...args),
}));
vi.mock("@/lib/repos/server/partnerRepo", () => ({
  upsert: (...args: unknown[]) => partnerUpsertSpy(...args),
  getByProfileId: (...args: unknown[]) => partnerGetByProfileId(...args),
}));

import { POST } from "@/app/api/checkout/attorney/verify/route";

// ---- Helpers ---------------------------------------------------------------

function makeSession(overrides: { metadata?: Record<string, unknown> } & Record<string, unknown> = {}) {
  const { metadata: metaOverride, ...rest } = overrides;
  return {
    id: "cs_test_1",
    payment_status: "paid",
    metadata: {
      flow: "attorney_signup",
      tier: "professional",
      bar_number: "P12345",
      firm_name: "Acme Law",
      practice_area: "estate",
      first_name: "Jane",
      last_name: "Doe",
      phone: "555-0100",
      ...(metaOverride ?? {}),
    },
    customer_email: "jane@example.com",
    amount_total: 600000,
    ...rest,
  };
}

async function callPost(body: Record<string, unknown> = { session_id: "cs_test_1", password: "Replay123!" }) {
  const req = new Request("https://ev.test/api/checkout/attorney/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req as never);
}

// ---- Tests -----------------------------------------------------------------

describe("attorney/verify — BUG-16 replay safety", () => {
  const prevResendKey = process.env.RESEND_API_KEY;
  const prevSalesEmail = process.env.SALES_NOTIFICATION_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.SALES_NOTIFICATION_EMAIL = "sales@ev.test";
    stripeRetrieve.mockResolvedValue(makeSession());
    adminCreateUser.mockResolvedValue({ data: { user: { id: "user-new-1" } }, error: null });
    profileUpsertSpy.mockResolvedValue({ error: null });
    partnerUpsertSpy.mockResolvedValue({ error: null });
    resendSend.mockResolvedValue({ error: null });
    // Defaults: no existing user, no existing partner (first-time signup).
    rpcMaybeSingle.mockResolvedValue({ data: null });
    partnerGetByProfileId.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    if (prevResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevResendKey;
    if (prevSalesEmail === undefined) delete process.env.SALES_NOTIFICATION_EMAIL;
    else process.env.SALES_NOTIFICATION_EMAIL = prevSalesEmail;
  });

  it("first signup: creates the user and the partner record, sends emails", async () => {
    const res = await callPost();
    expect(res.status).toBe(200);
    expect(adminCreateUser).toHaveBeenCalledTimes(1);
    expect(partnerUpsertSpy).toHaveBeenCalledTimes(1);
    const row = partnerUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row).toHaveProperty("profile_id", "user-new-1");
    // welcome email + sales notification both fire on first creation.
    expect(resendSend).toHaveBeenCalledTimes(2);
  });

  it("replay with an existing partner: never re-upserts the partner row", async () => {
    // Account + partner already exist from the first run.
    rpcMaybeSingle.mockResolvedValue({ data: { id: "user-existing-1", email: "jane@example.com" } });
    partnerGetByProfileId.mockResolvedValue({ data: { id: "partner-existing-1" } });

    const res = await callPost();
    expect(res.status).toBe(200);
    // The core BUG-16 guarantee: no partner write → tier/fee/status preserved.
    expect(partnerUpsertSpy).not.toHaveBeenCalled();
  });

  it("replay never writes a body-supplied password onto an existing account", async () => {
    rpcMaybeSingle.mockResolvedValue({ data: { id: "user-existing-1", email: "jane@example.com" } });
    partnerGetByProfileId.mockResolvedValue({ data: { id: "partner-existing-1" } });

    await callPost({ session_id: "cs_test_1", password: "AttackerChosen99!" });
    // createUser is the only path that would set a password — it must not run.
    expect(adminCreateUser).not.toHaveBeenCalled();
  });

  it("replay with an existing partner sends no emails (no re-spam)", async () => {
    rpcMaybeSingle.mockResolvedValue({ data: { id: "user-existing-1", email: "jane@example.com" } });
    partnerGetByProfileId.mockResolvedValue({ data: { id: "partner-existing-1" } });

    await callPost();
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("resume: existing user but missing partner creates the partner, still no password write", async () => {
    // First run created the auth user but the partner upsert had failed.
    rpcMaybeSingle.mockResolvedValue({ data: { id: "user-existing-1", email: "jane@example.com" } });
    partnerGetByProfileId.mockResolvedValue({ data: null });

    const res = await callPost();
    expect(res.status).toBe(200);
    expect(adminCreateUser).not.toHaveBeenCalled(); // never touch the password
    expect(partnerUpsertSpy).toHaveBeenCalledTimes(1); // but finish the partner
    const row = partnerUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row).toHaveProperty("profile_id", "user-existing-1");
  });

  it("create-user race ('already been registered') re-resolves instead of failing", async () => {
    // Lookup said no user, but createUser lost a race to a concurrent replay.
    rpcMaybeSingle
      .mockResolvedValueOnce({ data: null }) // initial lookup: none
      .mockResolvedValueOnce({ data: { id: "user-raced-1", email: "jane@example.com" } }); // re-resolve
    adminCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });
    partnerGetByProfileId.mockResolvedValue({ data: null });

    const res = await callPost();
    expect(res.status).toBe(200);
    const row = partnerUpsertSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row).toHaveProperty("profile_id", "user-raced-1");
  });
});
