/**
 * Attorney Review Routing Resolver
 *
 * Determines who reviews a document and where the $300 fee goes.
 *
 * EstateVault runs a SINGLE in-house reviewing attorney. Partners do not
 * register their own reviewers, so every review routes to in-house counsel and
 * the fee always stays with EstateVault.
 *
 * ROUTING TABLE:
 * ┌─────────────────────────────────────────────────┬──────────────────────┬───────────────┐
 * │ Scenario                                        │ Reviewer             │ $300 Goes To  │
 * ├─────────────────────────────────────────────────┼──────────────────────┼───────────────┤
 * │ Direct EstateVault client (no partner)          │ In-house (W-2)       │ EstateVault   │
 * │ Any partner (attorney or not)                   │ In-house (W-2)       │ EstateVault   │
 * └─────────────────────────────────────────────────┴──────────────────────┴───────────────┘
 *
 * COMPLIANCE, Fee-splitting protection:
 * The in-house reviewer is a W-2 employee of EstateVault. The $300 is employment
 * revenue for EstateVault, NOT fee-splitting. This is a critical legal distinction.
 */

import type { ReviewRouting, PartnerForRouting } from "./types";
import { DEFAULT_ATTORNEY_REVIEW_FEE } from "@/lib/orders/pricing";

export const INHOUSE_ATTORNEY_EMAIL = "test-attorney@estatevault.test";
export const ESTATEVAULT_ADMIN_EMAIL = "ockmedk@gmail.com";
export const DEFAULT_REVIEW_FEE_CENTS = DEFAULT_ATTORNEY_REVIEW_FEE;

/**
 * Resolves the review routing for an order.
 *
 * @param partner - The partner record if order came through a partner, or null for direct clients
 * @param inhouseAttorneyProfileId - Mo's profile ID (looked up by caller)
 * @param adminProfileId - EstateVault admin profile ID (looked up by caller)
 * @param platformDefaultFee - Admin-set platform-default review fee in cents
 *   (from `app_settings`); used for all EstateVault-destined reviews. Defaults
 *   to the hardcoded fallback when the caller has no DB lookup.
 * @returns ReviewRouting with reviewer assignment, fee destination, and fee controller
 */
export function resolveReviewRouting(
  partner: PartnerForRouting | null,
  inhouseAttorneyProfileId: string | null,
  adminProfileId: string | null,
  platformDefaultFee: number = DEFAULT_REVIEW_FEE_CENTS
): ReviewRouting {
  // EstateVault operates a single in-house reviewing attorney. Partners cannot
  // register their own reviewer, so EVERY review — direct client or any partner
  // type — routes to in-house counsel and the fee stays with EstateVault
  // (employment revenue for a W-2 attorney, NOT fee-splitting). This is
  // deliberately partner-agnostic: even a legacy partner row with a stale
  // inhouse_review_attorney_id can no longer divert a review or its fee.
  return {
    reviewerId: inhouseAttorneyProfileId,
    reviewerType: "inhouse_estatevault",
    feeDestination: "estatevault",
    feeAmount: platformDefaultFee,
    feeControlledBy: adminProfileId,
    partnerId: partner?.id ?? null,
  };
}
