// Stage 3.2 — guards for two business-rule invariants surfaced during the
// 3.x cleanups:
//   1. A partner self-update can NEVER set financial flags (forged PATCH).
//   2. The fixed $300 attorney review holds: custom_review_fee only applies for
//      an attorney partner with an in-house reviewer; it's ignored otherwise
//      (the 3.6 invariant).

import { describe, it, expect } from "vitest";
import { partnerSelfUpdateSchema } from "@/lib/validation/schemas";
import { resolveReviewRouting, DEFAULT_REVIEW_FEE_CENTS } from "@/lib/attorney-review/routing";
import { DEFAULT_ATTORNEY_REVIEW_FEE, clampAttorneyReviewFee } from "@/lib/orders/pricing";
import type { PartnerForRouting } from "@/lib/attorney-review/types";

describe("partner self-update whitelist drops financial flags (forged PATCH)", () => {
  it("strips one_time_fee_paid / platform_fee_amount / annual_fee_paid", () => {
    const forged = {
      onboarding_step: 3,
      one_time_fee_paid: true,
      platform_fee_amount: 999999,
      annual_fee_paid: true,
      tier: "enterprise",
      partner_revenue_pct: 100,
    };
    const out = partnerSelfUpdateSchema.parse(forged);
    // The non-financial field survives…
    expect(out.onboarding_step).toBe(3);
    // …every financial / pricing field is dropped (Zod strips unknown keys).
    expect(out).not.toHaveProperty("one_time_fee_paid");
    expect(out).not.toHaveProperty("platform_fee_amount");
    expect(out).not.toHaveProperty("annual_fee_paid");
    expect(out).not.toHaveProperty("tier");
    expect(out).not.toHaveProperty("partner_revenue_pct");
  });
});

describe("attorney review fee — fixed $300 invariant (3.6)", () => {
  const base: PartnerForRouting = {
    id: "p1",
    profile_id: "prof1",
    professional_type: "attorney",
    has_inhouse_estate_attorney: true,
    inhouse_review_attorney_id: "att1",
    custom_review_fee: 12345, // a non-standard fee the partner set
    stripe_account_id: "acct1",
  };

  it("non-attorney partner: custom_review_fee IGNORED → fixed $300", () => {
    const routing = resolveReviewRouting(
      { ...base, professional_type: "financial_advisor", custom_review_fee: 99999 },
      "moAtt",
      "admin",
    );
    expect(routing.feeAmount).toBe(DEFAULT_REVIEW_FEE_CENTS);
    expect(routing.reviewerType).toBe("inhouse_estatevault");
  });

  it("attorney partner WITHOUT an in-house reviewer: custom_review_fee IGNORED → fixed $300", () => {
    const routing = resolveReviewRouting(
      { ...base, has_inhouse_estate_attorney: false, inhouse_review_attorney_id: null, custom_review_fee: 99999 },
      "moAtt",
      "admin",
    );
    expect(routing.feeAmount).toBe(DEFAULT_REVIEW_FEE_CENTS);
  });

  it("no partner (direct EstateVault client): fixed $300", () => {
    const routing = resolveReviewRouting(null, "moAtt", "admin");
    expect(routing.feeAmount).toBe(DEFAULT_REVIEW_FEE_CENTS);
    expect(routing.feeDestination).toBe("estatevault");
  });

  it("routes every partner to the in-house reviewer, whatever the partner row says", () => {
    // EstateVault runs one W-2 reviewing attorney, so a partner cannot divert a
    // review or its fee. This replaces two cases written against the older
    // model, where an attorney partner with their own reviewer kept the fee.
    const attorneyPartner = { ...base, has_inhouse_estate_attorney: true, inhouse_review_attorney_id: "their-atty" };
    const routing = resolveReviewRouting(attorneyPartner, "moAtt", "admin");
    expect(routing.reviewerType).toBe("inhouse_estatevault");
    expect(routing.feeDestination).toBe("estatevault");
    expect(routing.reviewerId).toBe("moAtt");
  });

  it("ignores custom_review_fee entirely — the charged fee is the platform default", () => {
    // Was: "custom_review_fee is clamped to ATTORNEY_REVIEW_FEE_RANGE (BUG-4)".
    // The column is no longer read, which is a stronger guarantee than clamping
    // it: an out-of-range value cannot reach Stripe because it is never used.
    // clampAttorneyReviewFee still guards the admin-set platform default.
    for (const fee of [999999, 50000, 1, -5]) {
      const routing = resolveReviewRouting({ ...base, custom_review_fee: fee }, "moAtt", "admin");
      expect(routing.feeAmount).toBe(DEFAULT_ATTORNEY_REVIEW_FEE);
    }
    expect(clampAttorneyReviewFee(999999)).toBe(150000);
    expect(clampAttorneyReviewFee(1)).toBe(15000);
  });

  it("platform default fee param feeds EstateVault-destined reviews", () => {
    const routing = resolveReviewRouting(null, "moAtt", "admin", 45000);
    expect(routing.feeAmount).toBe(45000);
    expect(routing.feeDestination).toBe("estatevault");
  });
});
