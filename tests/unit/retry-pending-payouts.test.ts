// BUG-15 follow-up — stuck `pending` partner payouts must clear once the
// Connect account can receive transfers.
//
// At checkout, a partner cut we cannot send yet is recorded as a `pending`
// payout IOU. retryPendingPartnerPayouts is the resolver: when the account's
// `transfers` capability is active it transfers each IOU and flips it to `sent`.
// It must (a) do nothing until transfers are active, (b) be safe against a
// racing trigger (markPayoutSent returns null → no double audit), and (c) never
// let one failing row abort the rest.

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getStripeAndTier: vi.fn(),
  getAccountStatus: vi.fn(),
  transferToPartner: vi.fn(),
  listPendingByPartner: vi.fn(),
  markPayoutSent: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/stripe-payouts", () => ({
  getAccountStatus: (...a: unknown[]) => h.getAccountStatus(...a),
  transferToPartner: (...a: unknown[]) => h.transferToPartner(...a),
}));
vi.mock("@/lib/repos/server/partnerRepo", () => ({
  getStripeAndTier: (...a: unknown[]) => h.getStripeAndTier(...a),
}));
vi.mock("@/lib/repos/server/payoutRepo", () => ({
  listPendingByPartner: (...a: unknown[]) => h.listPendingByPartner(...a),
  markPayoutSent: (...a: unknown[]) => h.markPayoutSent(...a),
}));
vi.mock("@/lib/repos/server/auditLogRepo", () => ({
  insertEntry: (...a: unknown[]) => h.audit(...a),
}));

import { retryPendingPartnerPayouts } from "@/lib/payouts/retryPendingPartnerPayouts";

const admin = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  // Default happy path: account exists, transfers active, markPayoutSent wins.
  // The transfer is keyed on the ORDER id (3rd arg), mirroring transferToPartner.
  h.getStripeAndTier.mockResolvedValue({ data: { stripe_account_id: "acct_1", tier: "standard" } });
  h.getAccountStatus.mockResolvedValue({ transfers_active: true });
  h.transferToPartner.mockImplementation(async (_acct, _amt, orderId) => ({ id: `tr_${orderId}` }));
  h.markPayoutSent.mockResolvedValue({ data: { id: "ok" } });
});

describe("retryPendingPartnerPayouts", () => {
  it("transfers and marks each pending payout sent when transfers are active", async () => {
    h.listPendingByPartner.mockResolvedValue({
      data: [
        { id: "po_1", amount: 30000, order_id: "ord_1", orders_included: ["ord_1"] },
        { id: "po_2", amount: 40000, order_id: "ord_2", orders_included: ["ord_2"] },
      ],
    });

    const res = await retryPendingPartnerPayouts(admin, "partner_1");

    expect(res).toEqual({ cleared: 2, total: 2 });
    expect(h.transferToPartner).toHaveBeenCalledTimes(2);
    // Keyed on the order id, not the payout row id.
    expect(h.transferToPartner).toHaveBeenCalledWith("acct_1", 30000, "ord_1", "partner_1", "pending_retry");
    expect(h.markPayoutSent).toHaveBeenCalledWith(admin, "po_1", "tr_ord_1");
    expect(h.audit).toHaveBeenCalledTimes(2);
  });

  it("falls back to orders_included[0] when order_id is null", async () => {
    h.listPendingByPartner.mockResolvedValue({
      data: [{ id: "po_1", amount: 30000, order_id: null, orders_included: ["ord_legacy"] }],
    });

    const res = await retryPendingPartnerPayouts(admin, "partner_1");

    expect(res).toEqual({ cleared: 1, total: 1 });
    expect(h.transferToPartner).toHaveBeenCalledWith("acct_1", 30000, "ord_legacy", "partner_1", "pending_retry");
  });

  it("does nothing until the transfers capability is active", async () => {
    h.getAccountStatus.mockResolvedValue({ transfers_active: false });
    h.listPendingByPartner.mockResolvedValue({ data: [{ id: "po_1", amount: 30000, order_id: "ord_1" }] });

    const res = await retryPendingPartnerPayouts(admin, "partner_1");

    expect(res).toEqual({ cleared: 0, total: 0 });
    expect(h.transferToPartner).not.toHaveBeenCalled();
    expect(h.listPendingByPartner).not.toHaveBeenCalled();
  });

  it("returns early when the partner has no Connect account", async () => {
    h.getStripeAndTier.mockResolvedValue({ data: { stripe_account_id: null, tier: "standard" } });

    const res = await retryPendingPartnerPayouts(admin, "partner_1");

    expect(res).toEqual({ cleared: 0, total: 0 });
    expect(h.getAccountStatus).not.toHaveBeenCalled();
  });

  it("does not double-count or double-audit when a racing trigger already flipped the row", async () => {
    h.listPendingByPartner.mockResolvedValue({ data: [{ id: "po_1", amount: 30000, order_id: "ord_1" }] });
    // markPayoutSent's conditional update found no still-pending row (race lost).
    h.markPayoutSent.mockResolvedValue({ data: null });

    const res = await retryPendingPartnerPayouts(admin, "partner_1");

    expect(res).toEqual({ cleared: 0, total: 1 });
    expect(h.transferToPartner).toHaveBeenCalledTimes(1);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("uses the same Stripe idempotency input for duplicate rows of one order (no double-pay)", async () => {
    // Two payout rows for the SAME order (a duplicate that slipped the DB guard).
    // Both transfer calls key on the order id, so Stripe collapses them to one
    // real transfer — the code never sends twice.
    h.listPendingByPartner.mockResolvedValue({
      data: [
        { id: "po_a", amount: 40000, order_id: "ord_dup", orders_included: ["ord_dup"] },
        { id: "po_b", amount: 40000, order_id: "ord_dup", orders_included: ["ord_dup"] },
      ],
    });

    await retryPendingPartnerPayouts(admin, "partner_1");

    expect(h.transferToPartner).toHaveBeenCalledTimes(2);
    // Both calls carry the identical order id → identical idempotency key at Stripe.
    expect(h.transferToPartner).toHaveBeenNthCalledWith(1, "acct_1", 40000, "ord_dup", "partner_1", "pending_retry");
    expect(h.transferToPartner).toHaveBeenNthCalledWith(2, "acct_1", 40000, "ord_dup", "partner_1", "pending_retry");
  });

  it("keeps processing other rows when one transfer throws", async () => {
    h.listPendingByPartner.mockResolvedValue({
      data: [
        { id: "po_bad", amount: 30000, order_id: "ord_bad" },
        { id: "po_good", amount: 40000, order_id: "ord_good" },
      ],
    });
    h.transferToPartner.mockImplementation(async (_acct, _amt, orderId) => {
      if (orderId === "ord_bad") throw new Error("stripe down");
      return { id: `tr_${orderId}` };
    });

    const res = await retryPendingPartnerPayouts(admin, "partner_1");

    expect(res).toEqual({ cleared: 1, total: 2 });
    expect(h.markPayoutSent).toHaveBeenCalledWith(admin, "po_good", "tr_ord_good");
    expect(h.markPayoutSent).not.toHaveBeenCalledWith(admin, "po_bad", expect.anything());
  });

  it("skips zero/negative amount rows", async () => {
    h.listPendingByPartner.mockResolvedValue({ data: [{ id: "po_1", amount: 0, order_id: "ord_1" }] });

    const res = await retryPendingPartnerPayouts(admin, "partner_1");

    expect(res).toEqual({ cleared: 0, total: 1 });
    expect(h.transferToPartner).not.toHaveBeenCalled();
  });
});
