// BUG-25 fix verification — lib/webhooks/stripe/handleAttorneyReview.ts.
//
// Before the fix, the partner-admin attorney-review fee transfer sat in a
// try/catch that only console.error'd, with no payability check and no payout
// fallback row — so an unpayable/incomplete Connect account meant the client
// paid $300 for review, the reviewer was never paid, and NOTHING was
// recoverable. The fix mirrors BUG-15: check transfers_active, and on any
// can't-send case write a `pending` payout IOU; on success write a `sent` row.

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  resolveRouting: vi.fn(),
  getReviewRoutingInfo: vi.fn(),
  getAttorneyCut: vi.fn(),
  getAccountStatus: vi.fn(),
  transfersCreate: vi.fn(),
  insertPartnerPayout: vi.fn(),
  reviewInsert: vi.fn(),
  audit: vi.fn(),
  platformDefaultFee: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({ stripe: { transfers: { create: (...a: unknown[]) => h.transfersCreate(...a) } } }));
vi.mock("@/lib/stripe-payouts", () => ({ getAccountStatus: (...a: unknown[]) => h.getAccountStatus(...a) }));
vi.mock("@/lib/attorney-review/fee", () => ({ getPlatformDefaultReviewFee: (...a: unknown[]) => h.platformDefaultFee(...a) }));
vi.mock("@/lib/attorney-review/routing", () => ({
  resolveReviewRouting: (...a: unknown[]) => h.resolveRouting(...a),
  INHOUSE_ATTORNEY_EMAIL: "mo@example.test",
  ESTATEVAULT_ADMIN_EMAIL: "admin@example.test",
}));
vi.mock("@/lib/repos/server/partnerRepo", () => ({ getReviewRoutingInfo: (...a: unknown[]) => h.getReviewRoutingInfo(...a) }));
vi.mock("@/lib/repos/server/orderRepo", () => ({ getAttorneyCut: (...a: unknown[]) => h.getAttorneyCut(...a) }));
vi.mock("@/lib/repos/server/payoutRepo", () => ({ insertPartnerPayout: (...a: unknown[]) => h.insertPartnerPayout(...a) }));
vi.mock("@/lib/repos/server/profileRepo", () => ({ findIdByEmailMaybe: vi.fn(async () => ({ data: { id: "prof_x" } })) }));
vi.mock("@/lib/repos/server/attorneyReviewRepo", () => ({ insert: (...a: unknown[]) => h.reviewInsert(...a) }));
vi.mock("@/lib/repos/server/auditLogRepo", () => ({ insertEntry: (...a: unknown[]) => h.audit(...a) }));

import { handleAttorneyReview } from "@/lib/webhooks/stripe/handleAttorneyReview";

const admin = {} as never;
const ORDER = "order_1";
const FEE = 30000;

function routing(over: Record<string, unknown> = {}) {
  return {
    reviewerId: "rev_1",
    reviewerType: "partner_admin",
    feeDestination: "partner_admin",
    feeControlledBy: "partner",
    partnerId: "partner_1",
    feeAmount: FEE,
    ...over,
  };
}

const pendingCall = () =>
  h.insertPartnerPayout.mock.calls.find((c) => (c[1] as { status?: string }).status === "pending");
const sentCall = () =>
  h.insertPartnerPayout.mock.calls.find((c) => (c[1] as { status?: string }).status === "sent");

beforeEach(() => {
  vi.clearAllMocks();
  h.platformDefaultFee.mockResolvedValue(FEE);
  h.getAttorneyCut.mockResolvedValue({ data: { attorney_cut: FEE } });
  h.resolveRouting.mockReturnValue(routing());
  h.getReviewRoutingInfo.mockResolvedValue({ data: { stripe_account_id: "acct_x", profile_id: "pf", has_inhouse_estate_attorney: true } });
  h.getAccountStatus.mockResolvedValue({ transfers_active: true });
  h.transfersCreate.mockResolvedValue({ id: "tr_atty" });
});

describe("BUG-25 — attorney-review fee never silently vanishes", () => {
  it("transfers capability inactive → 'pending' payout, no transfer", async () => {
    h.getAccountStatus.mockResolvedValue({ transfers_active: false });

    await handleAttorneyReview(admin, ORDER, "partner_1", "will");

    expect(h.transfersCreate).not.toHaveBeenCalled();
    expect(pendingCall()![1]).toMatchObject({ partner_id: "partner_1", amount: FEE, status: "pending" });
  });

  it("account status check throws → treated as unpayable → 'pending' payout", async () => {
    h.getAccountStatus.mockRejectedValue(new Error("stripe down"));

    await handleAttorneyReview(admin, ORDER, "partner_1", "will");

    expect(h.transfersCreate).not.toHaveBeenCalled();
    expect(pendingCall()).toBeTruthy();
  });

  it("no Connect account → 'pending' payout, never checks status or transfers", async () => {
    h.getReviewRoutingInfo.mockResolvedValue({ data: { stripe_account_id: null, profile_id: "pf", has_inhouse_estate_attorney: true } });

    await handleAttorneyReview(admin, ORDER, "partner_1", "will");

    expect(h.getAccountStatus).not.toHaveBeenCalled();
    expect(h.transfersCreate).not.toHaveBeenCalled();
    expect(pendingCall()).toBeTruthy();
  });

  it("transfer throws after passing the payable check → catch records 'pending' (money not dropped)", async () => {
    h.transfersCreate.mockRejectedValue(new Error("transfer failed"));

    await handleAttorneyReview(admin, ORDER, "partner_1", "will");

    expect(pendingCall()).toBeTruthy();
    expect(sentCall()).toBeFalsy();
  });

  it("payable account → transfer + 'sent' payout, no 'pending' row", async () => {
    await handleAttorneyReview(admin, ORDER, "partner_1", "will");

    expect(h.transfersCreate).toHaveBeenCalledOnce();
    expect(sentCall()![1]).toMatchObject({ partner_id: "partner_1", amount: FEE, status: "sent", stripe_transfer_id: "tr_atty" });
    expect(pendingCall()).toBeFalsy();
  });

  it("nothing collected (attorney_cut=0) → no transfer, no payout row", async () => {
    h.getAttorneyCut.mockResolvedValue({ data: { attorney_cut: 0 } });

    await handleAttorneyReview(admin, ORDER, "partner_1", "will");

    expect(h.transfersCreate).not.toHaveBeenCalled();
    expect(h.insertPartnerPayout).not.toHaveBeenCalled();
  });

  it("fee not destined to a partner (platform-kept) → no payout, no transfer", async () => {
    h.resolveRouting.mockReturnValue(routing({ feeDestination: "platform", partnerId: null }));

    await handleAttorneyReview(admin, ORDER, "partner_1", "will");

    expect(h.insertPartnerPayout).not.toHaveBeenCalled();
    expect(h.transfersCreate).not.toHaveBeenCalled();
  });
});
