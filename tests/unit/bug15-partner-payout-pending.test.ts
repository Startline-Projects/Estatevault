// BUG-15 regression — partner payout must never silently vanish.
//
// When a partner has a Connect account but it cannot RECEIVE a transfer yet
// (transfers capability not active), or the transfer throws, the handler must
// still leave a reconcilable `pending` payout row + write the owed split —
// instead of only console.error'ing and dropping the money.
//
// calculateSplit is intentionally NOT mocked — we assert the real owed cut.

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  orderUpdate: vi.fn(),
  getStripeAndTier: vi.fn(),
  transferToPartner: vi.fn(),
  getAccountStatus: vi.fn(),
  insertPartnerPayout: vi.fn(),
  insertMany: vi.fn(),
  getLatestAnswers: vi.fn(),
  findIdAndNameByEmail: vi.fn(),
  audit: vi.fn(),
  addJob: vi.fn(),
}));

vi.mock("@/lib/stripe-payouts", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/stripe-payouts")>();
  return {
    calculateSplit: actual.calculateSplit, // REAL split math
    transferToPartner: (...a: unknown[]) => h.transferToPartner(...a),
    transferToAffiliate: vi.fn(),
    getAccountStatus: (...a: unknown[]) => h.getAccountStatus(...a),
  };
});
vi.mock("@/lib/config/appUrl", () => ({ getAppUrl: () => "http://test.local" }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));
vi.mock("@/lib/queue/document-queue", () => ({
  addJob: (...a: unknown[]) => h.addJob(...a),
  isQueueConfigured: false,
}));

vi.mock("@/lib/repos/server/orderRepo", () => ({ update: (...a: unknown[]) => h.orderUpdate(...a) }));
vi.mock("@/lib/repos/server/partnerRepo", () => ({ getStripeAndTier: (...a: unknown[]) => h.getStripeAndTier(...a) }));
vi.mock("@/lib/repos/server/payoutRepo", () => ({
  insertPartnerPayout: (...a: unknown[]) => h.insertPartnerPayout(...a),
  insertAffiliatePayout: vi.fn(),
}));
vi.mock("@/lib/repos/server/documentRepo", () => ({ insertMany: (...a: unknown[]) => h.insertMany(...a) }));
vi.mock("@/lib/repos/server/quizSessionRepo", () => ({ getLatestAnswersByClient: (...a: unknown[]) => h.getLatestAnswers(...a) }));
vi.mock("@/lib/repos/server/profileRepo", () => ({
  findIdAndNameByEmail: (...a: unknown[]) => h.findIdAndNameByEmail(...a),
  findIdByEmailMaybe: vi.fn(async () => ({ data: { id: "prof_1" } })),
  upsert: vi.fn(),
}));
vi.mock("@/lib/repos/server/clientRepo", () => ({ setProfileId: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/repos/server/affiliateRepo", () => ({ getStripeAccountById: vi.fn(), incrementStats: vi.fn() }));
vi.mock("@/lib/repos/server/auditLogRepo", () => ({ insertEntry: (...a: unknown[]) => h.audit(...a) }));

import { handleDocumentCheckout } from "@/lib/webhooks/stripe/handleDocumentCheckout";

// Chainable supabase stub — all replay-safety reads resolve empty (fresh order).
function makeAdmin() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.contains = chain;
  builder.update = chain;
  builder.maybeSingle = () => Promise.resolve({ data: null });
  builder.single = () => Promise.resolve({ data: null });
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: [] });
  return { from: () => builder } as never;
}
const admin = makeAdmin();

function session() {
  return {
    id: "cs_doc_1",
    amount_total: 40000,
    payment_intent: "pi_doc_1",
    customer_details: { email: "buyer@example.test", name: "Buyer One" },
  } as never;
}

function meta(partnerId: string) {
  return {
    order_id: "order_1",
    client_id: "client_1",
    product_type: "will",
    attorney_review: "false",
    partner_id: partnerId,
  } as Record<string, string>;
}

function pendingCall() {
  return h.insertPartnerPayout.mock.calls.find(
    (c) => (c[1] as { status?: string }).status === "pending",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.findIdAndNameByEmail.mockResolvedValue({ data: { id: "prof_1", full_name: "Buyer One" } });
  h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_1", answers: { a: 1 } } });
  h.transferToPartner.mockResolvedValue({ id: "tr_1" });
  // BUG-24: handler now checks the insert result — resolve a {error} shape.
  h.insertMany.mockResolvedValue({ error: null });
});

describe("BUG-15 — connected-but-unpayable partner", () => {
  it("transfers capability inactive → writes 'pending' payout + split, no transfer", async () => {
    h.getStripeAndTier.mockResolvedValue({ data: { stripe_account_id: "acct_x", tier: "standard" } });
    h.getAccountStatus.mockResolvedValue({ transfers_active: false });

    await handleDocumentCheckout(admin, session(), meta("partner_unpayable"));

    expect(h.transferToPartner).not.toHaveBeenCalled();
    const pending = pendingCall();
    expect(pending).toBeTruthy();
    expect(pending![1]).toMatchObject({ partner_id: "partner_unpayable", status: "pending" });
    expect((pending![1] as { amount: number }).amount).toBeGreaterThan(0);
    // Owed split is still written to the order.
    const splitUpdate = h.orderUpdate.mock.calls.find(
      (c) => c[2] && Object.prototype.hasOwnProperty.call(c[2], "partner_cut"),
    );
    expect(splitUpdate).toBeTruthy();
  });

  it("account status check throws → treated as unpayable → 'pending' payout", async () => {
    h.getStripeAndTier.mockResolvedValue({ data: { stripe_account_id: "acct_x", tier: "enterprise" } });
    h.getAccountStatus.mockRejectedValue(new Error("stripe down"));

    await handleDocumentCheckout(admin, session(), meta("partner_statuserr"));

    expect(h.transferToPartner).not.toHaveBeenCalled();
    expect(pendingCall()).toBeTruthy();
  });
});

describe("BUG-15 — transfer fails after passing the payable check", () => {
  it("transferToPartner throws → catch records 'pending' payout (money not dropped)", async () => {
    h.getStripeAndTier.mockResolvedValue({ data: { stripe_account_id: "acct_x", tier: "standard" } });
    h.getAccountStatus.mockResolvedValue({ transfers_active: true });
    h.transferToPartner.mockRejectedValue(new Error("transfers capability inactive"));

    await handleDocumentCheckout(admin, session(), meta("partner_throw"));

    expect(h.transferToPartner).toHaveBeenCalled();
    expect(pendingCall()).toBeTruthy();
  });

  it("transferToPartner returns null → 'pending' payout, no 'sent' row", async () => {
    h.getStripeAndTier.mockResolvedValue({ data: { stripe_account_id: "acct_x", tier: "standard" } });
    h.getAccountStatus.mockResolvedValue({ transfers_active: true });
    h.transferToPartner.mockResolvedValue(null);

    await handleDocumentCheckout(admin, session(), meta("partner_null"));

    expect(pendingCall()).toBeTruthy();
    const sent = h.insertPartnerPayout.mock.calls.find(
      (c) => (c[1] as { status?: string }).status === "sent",
    );
    expect(sent).toBeFalsy();
  });
});

describe("BUG-15 — payable partner still pays normally (no regression)", () => {
  it("transfers active → 'sent' payout, no 'pending' row", async () => {
    h.getStripeAndTier.mockResolvedValue({ data: { stripe_account_id: "acct_x", tier: "enterprise" } });
    h.getAccountStatus.mockResolvedValue({ transfers_active: true });

    await handleDocumentCheckout(admin, session(), meta("partner_ok"));

    expect(h.transferToPartner).toHaveBeenCalled();
    const sent = h.insertPartnerPayout.mock.calls.find(
      (c) => (c[1] as { status?: string }).status === "sent",
    );
    expect(sent).toBeTruthy();
    expect(pendingCall()).toBeFalsy();
  });
});
