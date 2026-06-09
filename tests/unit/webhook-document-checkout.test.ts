// Stage 3 — characterization test for the core money path:
// lib/webhooks/stripe/handleDocumentCheckout.ts (extracted in 3.5).
//
// Verifies the rules that must never break:
//   • correct document set per product (will → 3 docs, trust → 4)
//   • revenue split written from the REAL calculateSplit (Rules 5+6)
//   • connected partner → transfer + 'sent' payout; unconnected → 'pending'
//   • order moves to 'generating' and a generation job is queued
// calculateSplit is intentionally NOT mocked — we assert the real cents.

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  orderUpdate: vi.fn(),
  getStripeAndTier: vi.fn(),
  transferToPartner: vi.fn(),
  transferToAffiliate: vi.fn(),
  insertPartnerPayout: vi.fn(),
  insertAffiliatePayout: vi.fn(),
  insertMany: vi.fn(),
  getLatestAnswers: vi.fn(),
  findIdAndNameByEmail: vi.fn(),
  audit: vi.fn(),
  addJob: vi.fn(),
  clientSetProfileId: vi.fn(),
  clientCreate: vi.fn(),
}));

vi.mock("@/lib/stripe-payouts", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/stripe-payouts")>();
  return {
    calculateSplit: actual.calculateSplit, // REAL split math
    transferToPartner: (...a: unknown[]) => h.transferToPartner(...a),
    transferToAffiliate: (...a: unknown[]) => h.transferToAffiliate(...a),
  };
});
vi.mock("@/lib/config/appUrl", () => ({ getAppUrl: () => "http://test.local" }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));
vi.mock("@/lib/queue/document-queue", () => ({ addJob: (...a: unknown[]) => h.addJob(...a) }));

vi.mock("@/lib/repos/server/orderRepo", () => ({ update: (...a: unknown[]) => h.orderUpdate(...a) }));
vi.mock("@/lib/repos/server/partnerRepo", () => ({ getStripeAndTier: (...a: unknown[]) => h.getStripeAndTier(...a) }));
vi.mock("@/lib/repos/server/payoutRepo", () => ({
  insertPartnerPayout: (...a: unknown[]) => h.insertPartnerPayout(...a),
  insertAffiliatePayout: (...a: unknown[]) => h.insertAffiliatePayout(...a),
}));
vi.mock("@/lib/repos/server/documentRepo", () => ({ insertMany: (...a: unknown[]) => h.insertMany(...a) }));
vi.mock("@/lib/repos/server/quizSessionRepo", () => ({ getLatestAnswersByClient: (...a: unknown[]) => h.getLatestAnswers(...a) }));
vi.mock("@/lib/repos/server/profileRepo", () => ({
  findIdAndNameByEmail: (...a: unknown[]) => h.findIdAndNameByEmail(...a),
  findIdByEmailMaybe: vi.fn(async () => ({ data: { id: "prof_1" } })),
  upsert: vi.fn(),
}));
vi.mock("@/lib/repos/server/clientRepo", () => ({
  setProfileId: (...a: unknown[]) => h.clientSetProfileId(...a),
  create: (...a: unknown[]) => h.clientCreate(...a),
}));
vi.mock("@/lib/repos/server/affiliateRepo", () => ({ getStripeAccountById: vi.fn(), incrementStats: vi.fn() }));
vi.mock("@/lib/repos/server/auditLogRepo", () => ({ insertEntry: (...a: unknown[]) => h.audit(...a) }));

import { handleDocumentCheckout } from "@/lib/webhooks/stripe/handleDocumentCheckout";

// Stub admin: handles update().eq() and select().eq().single()/is().single()
const chainEnd = { single: () => Promise.resolve({ data: null }), eq: () => ({ single: () => Promise.resolve({ data: null }), is: () => ({ single: () => Promise.resolve({ data: null }) }) }) };
const admin = { from: () => ({ update: () => ({ eq: () => Promise.resolve({}) }), select: () => chainEnd }) } as never;

function session(amountTotal: number) {
  return {
    id: "cs_doc_1",
    amount_total: amountTotal,
    payment_intent: "pi_doc_1",
    customer_details: { email: "buyer@example.test", name: "Buyer One" },
  } as never;
}

function meta(productType: "will" | "trust", partnerId?: string) {
  return {
    order_id: "order_1",
    client_id: "client_1",
    product_type: productType,
    attorney_review: "false",
    ...(partnerId ? { partner_id: partnerId } : {}),
  } as Record<string, string>;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Existing profile with a name → skips account creation + the profiles.update.
  h.findIdAndNameByEmail.mockResolvedValue({ data: { id: "prof_1", full_name: "Buyer One" } });
  h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_1", answers: { a: 1 } } });
  h.transferToPartner.mockResolvedValue({ id: "tr_1" });
});

describe("handleDocumentCheckout — document set per product", () => {
  it("will → exactly [will, poa, healthcare_directive]", async () => {
    await handleDocumentCheckout(admin, session(40000), meta("will"));
    const rows = h.insertMany.mock.calls[0][1] as Array<{ document_type: string }>;
    expect(rows.map((r) => r.document_type)).toEqual(["will", "poa", "healthcare_directive"]);
  });

  it("trust → exactly [trust, pour_over_will, poa, healthcare_directive]", async () => {
    await handleDocumentCheckout(admin, session(60000), meta("trust"));
    const rows = h.insertMany.mock.calls[0][1] as Array<{ document_type: string }>;
    expect(rows.map((r) => r.document_type)).toEqual(["trust", "pour_over_will", "poa", "healthcare_directive"]);
  });

  it("moves the order to 'generating' and queues a generation job", async () => {
    await handleDocumentCheckout(admin, session(40000), meta("will"));
    expect(h.orderUpdate).toHaveBeenCalledWith(
      expect.anything(),
      "order_1",
      expect.objectContaining({ status: "generating" }),
    );
    expect(h.addJob).toHaveBeenCalledWith(expect.objectContaining({ order_id: "order_1", product_type: "will" }));
  });
});

describe("handleDocumentCheckout — revenue split (Rules 5+6, real calculateSplit)", () => {
  it("enterprise partner connected: writes split + transfers partner cut + 'sent' payout", async () => {
    h.getStripeAndTier.mockResolvedValue({ data: { stripe_account_id: "acct_1", tier: "enterprise" } });

    await handleDocumentCheckout(admin, session(40000), meta("will", "partner_ent"));

    // Real split: the order is updated with ev_cut + partner_cut > 0.
    const splitUpdate = h.orderUpdate.mock.calls.find(
      (c) => c[2] && Object.prototype.hasOwnProperty.call(c[2], "partner_cut"),
    );
    expect(splitUpdate).toBeTruthy();
    const patch = splitUpdate![2] as { ev_cut: number; partner_cut: number };
    expect(patch.partner_cut).toBeGreaterThan(0);
    expect(patch.ev_cut).toBeGreaterThanOrEqual(0);

    // Transfer the exact partner cut, then record a 'sent' payout for that amount.
    expect(h.transferToPartner).toHaveBeenCalledWith("acct_1", patch.partner_cut, "order_1", "partner_ent", "will");
    expect(h.insertPartnerPayout).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ partner_id: "partner_ent", amount: patch.partner_cut, status: "sent", stripe_transfer_id: "tr_1" }),
    );
  });

  it("partner NOT connected: writes split + queues a 'pending' payout, no transfer", async () => {
    h.getStripeAndTier.mockResolvedValue({ data: { stripe_account_id: null, tier: "standard" } });

    await handleDocumentCheckout(admin, session(40000), meta("will", "partner_std"));

    expect(h.transferToPartner).not.toHaveBeenCalled();
    expect(h.insertPartnerPayout).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ partner_id: "partner_std", status: "pending" }),
    );
  });

  it("no partner: no partner payout at all", async () => {
    await handleDocumentCheckout(admin, session(40000), meta("will"));
    expect(h.transferToPartner).not.toHaveBeenCalled();
    expect(h.insertPartnerPayout).not.toHaveBeenCalled();
  });
});

describe("handleDocumentCheckout — client-profile linking (Bug 8)", () => {
  function adminWithClient(clientData: { id: string; profile_id: string | null } | null) {
    const clientChain = {
      eq: () => ({
        single: () => Promise.resolve({ data: clientData }),
        is: () => ({ single: () => Promise.resolve({ data: clientData }) }),
      }),
    };
    return {
      from: () => ({
        update: () => ({ eq: () => Promise.resolve({}) }),
        select: () => clientChain,
      }),
    } as never;
  }

  it("existing profile + orphaned client → calls setProfileId", async () => {
    h.findIdAndNameByEmail.mockResolvedValue({ data: { id: "prof_1", full_name: "Buyer One" } });
    const testAdmin = adminWithClient({ id: "client_1", profile_id: null });

    await handleDocumentCheckout(testAdmin, session(40000), meta("will"));

    expect(h.clientSetProfileId).toHaveBeenCalledWith(testAdmin, "client_1", "prof_1");
  });

  it("existing profile + already-linked client → skips setProfileId", async () => {
    h.findIdAndNameByEmail.mockResolvedValue({ data: { id: "prof_1", full_name: "Buyer One" } });
    const testAdmin = adminWithClient({ id: "client_1", profile_id: "prof_1" });

    await handleDocumentCheckout(testAdmin, session(40000), meta("will"));

    expect(h.clientSetProfileId).not.toHaveBeenCalled();
  });

  it("no client record found → calls clientCreate as fallback", async () => {
    h.findIdAndNameByEmail.mockResolvedValue({ data: { id: "prof_1", full_name: "Buyer One" } });
    const testAdmin = adminWithClient(null);

    await handleDocumentCheckout(testAdmin, session(40000), meta("will"));

    expect(h.clientCreate).toHaveBeenCalledWith(
      testAdmin,
      expect.objectContaining({ id: "client_1", profile_id: "prof_1" }),
    );
  });
});
