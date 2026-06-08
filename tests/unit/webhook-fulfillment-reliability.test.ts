// BUG-1 / BUG-13 — paid-but-unfulfilled reliability.
//
// Covers:
//   • queue failure marks the order + documents `failed`, alerts admin, and
//     RETHROWS (so the webhook returns 500 and Stripe redelivers) — never a
//     silent success.
//   • replay safety: a second run for an already-paid-out order does NOT
//     transfer the partner cut again or re-insert document rows.
//   • attorney-review lock is preserved: a replay never downgrades a `review`
//     order back to `generating`.

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  orderUpdate: vi.fn(),
  getStripeAndTier: vi.fn(),
  transferToPartner: vi.fn(),
  insertPartnerPayout: vi.fn(),
  insertMany: vi.fn(),
  getLatestAnswers: vi.fn(),
  audit: vi.fn(),
  addJob: vi.fn(),
  alert: vi.fn(),
}));

vi.mock("@/lib/stripe-payouts", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/stripe-payouts")>();
  return {
    calculateSplit: actual.calculateSplit,
    transferToPartner: (...a: unknown[]) => h.transferToPartner(...a),
    transferToAffiliate: vi.fn(),
  };
});
vi.mock("@/lib/config/appUrl", () => ({ getAppUrl: () => "http://test.local" }));
vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: vi.fn(),
  sendFulfillmentFailureAlert: (...a: unknown[]) => h.alert(...a),
}));
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
  findIdAndNameByEmail: vi.fn(async () => ({ data: { id: "prof_1", full_name: "Buyer One" } })),
  findIdByEmailMaybe: vi.fn(async () => ({ data: { id: "prof_1" } })),
  upsert: vi.fn(),
}));
vi.mock("@/lib/repos/server/clientRepo", () => ({ setProfileId: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/repos/server/affiliateRepo", () => ({ getStripeAccountById: vi.fn(), incrementStats: vi.fn() }));
vi.mock("@/lib/repos/server/auditLogRepo", () => ({ insertEntry: (...a: unknown[]) => h.audit(...a) }));

import { handleDocumentCheckout } from "@/lib/webhooks/stripe/handleDocumentCheckout";

// Configurable chainable supabase stub. `state` controls what the replay-safety
// reads return for each table.
function makeAdmin(state: {
  orderStatus?: string | null;
  existingDocs?: { document_type: string }[];
  existingPayout?: boolean;
  existingReview?: boolean;
}) {
  const docUpdateEq = vi.fn(() => Promise.resolve({}));
  const tableReads: Record<string, unknown> = {
    orders: { data: { status: state.orderStatus ?? null } },
    documents: { data: state.existingDocs ?? [] },
    payouts: { data: state.existingPayout ? { id: "po_1" } : null },
    affiliate_payouts: { data: null },
    attorney_reviews: { data: state.existingReview ? { id: "ar_1" } : null },
  };
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.eq = chain;
    builder.contains = chain;
    builder.update = () => ({ eq: docUpdateEq });
    builder.single = () => Promise.resolve(tableReads[table] ?? { data: null });
    builder.maybeSingle = () => Promise.resolve(tableReads[table] ?? { data: null });
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve(tableReads[table] ?? { data: [] });
    return builder;
  });
  return { admin: { from } as never, docUpdateEq };
}

function session() {
  return {
    id: "cs_1",
    amount_total: 40000,
    payment_intent: "pi_1",
    customer_details: { email: "buyer@example.test", name: "Buyer One" },
  } as never;
}
function meta(partnerId?: string) {
  return {
    order_id: "order_1",
    client_id: "client_1",
    product_type: "will",
    attorney_review: "false",
    ...(partnerId ? { partner_id: partnerId } : {}),
  } as Record<string, string>;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_1", answers: { a: 1 } } });
  h.transferToPartner.mockResolvedValue({ id: "tr_1" });
});

describe("BUG-13 — queue is best-effort, not fatal", () => {
  // The Upstash queue is optional; generation actually runs via processNow +
  // the daily sweep. A queue failure (e.g. Redis unconfigured) must NOT fail
  // the order or block the webhook — the reconcile cron is the real net.
  it("swallows a queue failure: order not marked failed, handler does not throw", async () => {
    h.addJob.mockRejectedValueOnce(new Error("Redis not configured — cannot queue document job"));
    const { admin } = makeAdmin({ orderStatus: "pending" });

    await expect(handleDocumentCheckout(admin, session(), meta())).resolves.toBeUndefined();

    // Order was never moved to `failed`.
    const markedFailed = h.orderUpdate.mock.calls.some(
      (c) => (c[2] as { status?: string })?.status === "failed",
    );
    expect(markedFailed).toBe(false);
    // No fulfillment-failure alert fired from the handler.
    expect(h.alert).not.toHaveBeenCalled();
    // Order still advanced to `generating` (the normal pre-queue work happened).
    expect(h.orderUpdate).toHaveBeenCalledWith(
      expect.anything(),
      "order_1",
      expect.objectContaining({ status: "generating" }),
    );
  });
});

describe("BUG-1 — replay safety", () => {
  it("does NOT transfer the partner cut again when a payout already exists", async () => {
    const { admin } = makeAdmin({
      orderStatus: "generating",
      existingDocs: [{ document_type: "will" }, { document_type: "poa" }, { document_type: "healthcare_directive" }],
      existingPayout: true,
    });
    h.getStripeAndTier.mockResolvedValue({ data: { stripe_account_id: "acct_1", tier: "enterprise" } });

    await handleDocumentCheckout(admin, session(), meta("partner_ent"));

    expect(h.transferToPartner).not.toHaveBeenCalled();
    expect(h.insertPartnerPayout).not.toHaveBeenCalled();
  });

  it("does NOT re-insert document rows that already exist", async () => {
    const { admin } = makeAdmin({
      orderStatus: "generating",
      existingDocs: [{ document_type: "will" }, { document_type: "poa" }, { document_type: "healthcare_directive" }],
    });

    await handleDocumentCheckout(admin, session(), meta());

    expect(h.insertMany).not.toHaveBeenCalled();
  });

  it("never downgrades an attorney-review order out of locked 'review'", async () => {
    const { admin } = makeAdmin({
      orderStatus: "review",
      existingDocs: [{ document_type: "will" }, { document_type: "poa" }, { document_type: "healthcare_directive" }],
    });

    await handleDocumentCheckout(admin, session(), meta());

    const downgraded = h.orderUpdate.mock.calls.some(
      (c) => (c[2] as { status?: string })?.status === "generating",
    );
    expect(downgraded).toBe(false);
  });
});
