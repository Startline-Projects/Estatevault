/**
 * Attorney Review Routing Types
 *
 * COMPLIANCE NOTE — Fee-splitting protection:
 * - "inhouse_estatevault" reviewer (Mo): $300 is EstateVault employment revenue.
 *   Mo is W-2 payroll. This is NOT fee-splitting — it is employer revenue from
 *   a service performed by an employee.
 * - "inhouse_partner" reviewer: $300 goes to partner's Stripe Connect account.
 *   The partner pays their own attorney via their own payroll.
 * - "review_network" reviewer: $300 goes 100% to attorney's Stripe Connect.
 *   EstateVault earns $0. Never route these fees to EstateVault.
 */

export type ReviewerType = "inhouse_estatevault" | "inhouse_partner" | "review_network";

export type FeeDestination = "estatevault" | "partner_admin" | "attorney_stripe_connect";

export interface ReviewRouting {
  /** Profile ID of the assigned reviewer */
  reviewerId: string | null;
  /** Type of reviewer assignment */
  reviewerType: ReviewerType;
  /** Where the $300 review fee goes */
  feeDestination: FeeDestination;
  /** Fee amount in cents (default 30000 = $300) */
  feeAmount: number;
  /** Profile ID of the person who controls/sets the fee */
  feeControlledBy: string | null;
  /** Partner ID if order came through a partner */
  partnerId: string | null;
}

/** Minimal partner shape needed for routing decisions */
export interface PartnerForRouting {
  id: string;
  profile_id: string;
  professional_type: string | null;
  has_inhouse_estate_attorney: boolean;
  inhouse_review_attorney_id: string | null;
  custom_review_fee: number | null;
  stripe_account_id: string | null;
}

/** Minimal order shape needed for routing decisions */
export interface OrderForRouting {
  id: string;
  client_id: string;
  product_type: string;
  attorney_review_requested: boolean;
}
