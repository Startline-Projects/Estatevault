/**
 * Attorney Review Routing Resolver
 *
 * Determines who reviews a document and where the $300 fee goes.
 *
 * ROUTING TABLE:
 * ┌─────────────────────────────────────────────────┬──────────────────────┬───────────────┐
 * │ Scenario                                        │ Reviewer             │ $300 Goes To  │
 * ├─────────────────────────────────────────────────┼──────────────────────┼───────────────┤
 * │ Direct EstateVault client (no partner)          │ Mo (in-house, W-2)   │ EstateVault   │
 * │ Non-attorney partner                            │ Mo (in-house, W-2)   │ EstateVault   │
 * │ Attorney partner, NO in-house estate attorney  │ Mo (in-house, W-2)   │ EstateVault   │
 * │ Attorney partner, HAS in-house estate attorney │ Partner's attorney   │ Partner admin │
 * └─────────────────────────────────────────────────┴──────────────────────┴───────────────┘
 *
 * COMPLIANCE, Fee-splitting protection:
 * Mo Murshed (mmurshed@thepeoplesfirmpllc.com, Bar #P-79739) is a W-2 employee
 * of EstateVault. When reviews are routed to him, the $300 fee is employment
 * revenue for EstateVault, NOT fee-splitting. This is a critical legal distinction.
 *
 * Review Network attorneys (independent, Stripe Connect) receive 100% of the $300.
 * EstateVault earns $0 on Review Network reviews. Never route these fees to EstateVault.
 */

import type { ReviewRouting, PartnerForRouting } from "./types";

/**
 * Mo Murshed's email, used to look up his profile ID at runtime.
 * His profile must exist in the database with user_type = 'review_attorney'.
 */
export const INHOUSE_ATTORNEY_EMAIL = "mmurshed@thepeoplesfirmpllc.com";

/**
 * EstateVault admin email, controls fee for all in-house reviews.
 */
export const ESTATEVAULT_ADMIN_EMAIL = "ockmedk@gmail.com";

/**
 * Default attorney review fee in cents ($300).
 */
export const DEFAULT_REVIEW_FEE_CENTS = 30000;

/**
 * Resolves the review routing for an order.
 *
 * @param partner - The partner record if order came through a partner, or null for direct clients
 * @param inhouseAttorneyProfileId - Mo's profile ID (looked up by caller)
 * @param adminProfileId - EstateVault admin profile ID (looked up by caller)
 * @returns ReviewRouting with reviewer assignment, fee destination, and fee controller
 */
export function resolveReviewRouting(
  partner: PartnerForRouting | null,
  inhouseAttorneyProfileId: string | null,
  adminProfileId: string | null
): ReviewRouting {
  // ── Case 1: Direct EstateVault client (no partner) ────────────
  if (!partner) {
    return {
      reviewerId: inhouseAttorneyProfileId,
      reviewerType: "inhouse_estatevault",
      feeDestination: "estatevault",
      feeAmount: DEFAULT_REVIEW_FEE_CENTS,
      feeControlledBy: adminProfileId,
      partnerId: null,
    };
  }

  // ── Case 2: Non-attorney partner ──────────────────────────────
  if (partner.professional_type !== "attorney") {
    return {
      reviewerId: inhouseAttorneyProfileId,
      reviewerType: "inhouse_estatevault",
      feeDestination: "estatevault",
      feeAmount: DEFAULT_REVIEW_FEE_CENTS,
      feeControlledBy: adminProfileId,
      partnerId: partner.id,
    };
  }

  // ── Case 3: Attorney partner WITHOUT in-house estate attorney ──
  if (!partner.has_inhouse_estate_attorney || !partner.inhouse_review_attorney_id) {
    return {
      reviewerId: inhouseAttorneyProfileId,
      reviewerType: "inhouse_estatevault",
      feeDestination: "estatevault",
      feeAmount: DEFAULT_REVIEW_FEE_CENTS,
      feeControlledBy: adminProfileId,
      partnerId: partner.id,
    };
  }

  // ── Case 4: Attorney partner WITH in-house estate attorney ─────
  // Fee goes to partner admin's Stripe Connect account.
  // Partner pays their attorney via their own payroll.
  return {
    reviewerId: partner.inhouse_review_attorney_id,
    reviewerType: "inhouse_partner",
    feeDestination: "partner_admin",
    feeAmount: partner.custom_review_fee || DEFAULT_REVIEW_FEE_CENTS,
    feeControlledBy: partner.profile_id,
    partnerId: partner.id,
  };
}
