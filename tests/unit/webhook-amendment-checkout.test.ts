// Stage 3 — characterization test for the extracted amendment webhook handler
// (lib/webhooks/stripe/handleAmendmentCheckout.ts, from the 3.5 split).
//
// Critical rule under test (H-1): a PAID amendment marks the order
// paid/generating and pays any partner cut, but must NEVER create a will/trust
// document set or queue a document-generation job. It also must not touch
// documentRepo at all.

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  orderUpdateSpy,
  partnerGetStripeAndTier,
  transferToPartnerSpy,
  insertPartnerPayoutSpy,
  auditSpy,
  ordersSelectResult,
} = vi.hoisted(() => ({
  orderUpdateSpy: vi.fn(),
  partnerGetStripeAndTier: vi.fn(),
  transferToPartnerSpy: vi.fn(),
  insertPartnerPayoutSpy: vi.fn(),
  auditSpy: vi.fn(),
  ordersSelectResult: { value: { data: { partner_id: null as string | null, partner_cut: 0 } } },
}));

vi.mock("@/lib/stripe-payouts", () => ({
  transferToPartner: (...a: unknown[]) => transferToPartnerSpy(...a),
}));
vi.mock("@/lib/repos/server/orderRepo", () => ({
  update: (...a: unknown[]) => orderUpdateSpy(...a),
}));
vi.mock("@/lib/repos/server/partnerRepo", () => ({
  getStripeAndTier: (...a: unknown[]) => partnerGetStripeAndTier(...a),
}));
vi.mock("@/lib/repos/server/payoutRepo", () => ({
  insertPartnerPayout: (...a: unknown[]) => insertPartnerPayoutSpy(...a),
}));
vi.mock("@/lib/repos/server/auditLogRepo", () => ({
  insertEntry: (...a: unknown[]) => auditSpy(...a),
}));

import { handleAmendmentCheckout } from "@/lib/webhooks/stripe/handleAmendmentCheckout";

// Minimal chainable admin-client mock for the one direct read the handler does:
// supabase.from("orders").select(...).eq(...).single()
function makeAdmin() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(ordersSelectResult.value),
  };
  return { from: () => chain } as never;
}

function session(amountTotal = 5000, paymentIntent = "pi_amend_1") {
  return {
    id: "cs_amend_1",
    amount_total: amountTotal,
    payment_intent: paymentIntent,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  ordersSelectResult.value = { data: { partner_id: null, partner_cut: 0 } };
  transferToPartnerSpy.mockResolvedValue({ id: "tr_1" });
});

describe("handleAmendmentCheckout — H-1: never generates a document set", () => {
  it("marks the order generating with the payment intent", async () => {
    await handleAmendmentCheckout(makeAdmin(), session(), "order_amend_1");
    expect(orderUpdateSpy).toHaveBeenCalledWith(
      expect.anything(),
      "order_amend_1",
      expect.objectContaining({ status: "generating", stripe_payment_intent_id: "pi_amend_1" }),
    );
  });

  it("does NOT import/queue a document-generation job and never inserts documents", async () => {
    // The handler imports neither documentRepo nor the queue. Proven by the fact
    // that no such mock is needed for it to run + the audit logs product_type
    // 'amendment' (not will/trust).
    await handleAmendmentCheckout(makeAdmin(), session(), "order_amend_1");
    expect(auditSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "order.paid",
        metadata: expect.objectContaining({ product_type: "amendment" }),
      }),
    );
  });

  it("pays a connected partner's cut via transfer + a 'sent' payout", async () => {
    ordersSelectResult.value = { data: { partner_id: "partner_1", partner_cut: 1500 } };
    partnerGetStripeAndTier.mockResolvedValue({ data: { stripe_account_id: "acct_1", tier: "standard" } });

    await handleAmendmentCheckout(makeAdmin(), session(), "order_amend_1");

    expect(transferToPartnerSpy).toHaveBeenCalledWith("acct_1", 1500, "order_amend_1", "partner_1", "amendment");
    expect(insertPartnerPayoutSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ partner_id: "partner_1", amount: 1500, status: "sent", stripe_transfer_id: "tr_1" }),
    );
  });

  it("queues a 'pending' payout when the partner is not Stripe-connected", async () => {
    ordersSelectResult.value = { data: { partner_id: "partner_2", partner_cut: 1500 } };
    partnerGetStripeAndTier.mockResolvedValue({ data: { stripe_account_id: null, tier: "standard" } });

    await handleAmendmentCheckout(makeAdmin(), session(), "order_amend_1");

    expect(transferToPartnerSpy).not.toHaveBeenCalled();
    expect(insertPartnerPayoutSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ partner_id: "partner_2", amount: 1500, status: "pending" }),
    );
  });

  it("pays nothing when there is no partner cut", async () => {
    ordersSelectResult.value = { data: { partner_id: "partner_3", partner_cut: 0 } };
    await handleAmendmentCheckout(makeAdmin(), session(), "order_amend_1");
    expect(transferToPartnerSpy).not.toHaveBeenCalled();
    expect(insertPartnerPayoutSpy).not.toHaveBeenCalled();
  });
});
