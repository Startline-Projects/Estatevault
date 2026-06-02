// Server-side data access for the `partners` table — the only place that queries
// it from the API layer.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type PartnerInsert = Database["public"]["Tables"]["partners"]["Insert"];
type PartnerUpdate = Database["public"]["Tables"]["partners"]["Update"];

// Revenue tier for a partner id (drives the EV/partner split).
export function getTier(admin: Admin, partnerId: string) {
  return admin.from("partners").select("tier").eq("id", partnerId).single();
}

// The signed-in partner's own row (B2: backs GET /api/partner/me). Reusable by
// the pro/* screens that previously queried `partners` directly.
export function getByProfileId(admin: Admin, profileId: string) {
  return admin.from("partners").select("*").eq("profile_id", profileId).maybeSingle();
}

// Stripe Connect info + revenue percent, looked up by the public partner slug.
export function findStripeInfoBySlug(admin: Admin, partnerSlug: string) {
  return admin
    .from("partners")
    .select("id, stripe_account_id, partner_revenue_pct")
    .eq("partner_slug", partnerSlug)
    .single();
}

// Patch a partner row by id (e.g. tier, stripe_session_id).
export function update(admin: Admin, partnerId: string, patch: PartnerUpdate) {
  return admin.from("partners").update(patch).eq("id", partnerId);
}

// Insert a new partner row.
export function insert(admin: Admin, row: PartnerInsert) {
  return admin.from("partners").insert(row);
}

// Upsert a partner row (attorney signup retry flows).
export function upsert(admin: Admin, row: PartnerInsert) {
  return admin.from("partners").upsert(row);
}

// Stripe Connect account + tier for payout routing.
export function getStripeAndTier(admin: Admin, partnerId: string) {
  return admin
    .from("partners")
    .select("stripe_account_id, tier")
    .eq("id", partnerId)
    .single();
}

// Stripe account + revenue percent for vault subscription splits.
export function getStripeAndRevenuePct(admin: Admin, partnerId: string) {
  return admin
    .from("partners")
    .select("stripe_account_id, partner_revenue_pct")
    .eq("id", partnerId)
    .single();
}

// Full routing info for attorney review assignment.
export function getReviewRoutingInfo(admin: Admin, partnerId: string) {
  return admin
    .from("partners")
    .select("id, profile_id, professional_type, has_inhouse_estate_attorney, inhouse_review_attorney_id, custom_review_fee, stripe_account_id")
    .eq("id", partnerId)
    .single();
}

// Email config fields needed by partner email management routes.
export function getEmailSettingsByProfileId(admin: Admin, profileId: string) {
  return admin
    .from("partners")
    .select("id, resend_domain_id, sender_name, sender_email, sender_domain, email_verified, company_name")
    .eq("profile_id", profileId)
    .single();
}

// Domain/tier info for partner domain management.
export function getDomainInfoByProfileId(admin: Admin, profileId: string) {
  return admin
    .from("partners")
    .select("id, partner_slug, subdomain, custom_domain, vault_subdomain, tier, profile_id")
    .eq("profile_id", profileId)
    .single();
}

// Stripe Connect info for partner by profile_id.
export function getStripeByProfileId(admin: Admin, profileId: string) {
  return admin
    .from("partners")
    .select("id, stripe_account_id, sender_email")
    .eq("profile_id", profileId)
    .single();
}

// Partner info for vault-client-checkout flow.
export function getVaultCheckoutInfoByProfileId(admin: Admin, profileId: string) {
  return admin
    .from("partners")
    .select("id, company_name, tier")
    .eq("profile_id", profileId)
    .single();
}

// Check if vault subdomain is already taken.
export function isSubdomainTaken(admin: Admin, subdomain: string) {
  return admin
    .from("partners")
    .select("id")
    .eq("vault_subdomain", subdomain)
    .maybeSingle();
}

// Check if partner slug already exists.
export function findBySlug(admin: Admin, slug: string) {
  return admin.from("partners").select("id").eq("partner_slug", slug).single();
}

// Partner profile_id lookup by partner id.
export function getProfileId(admin: Admin, partnerId: string) {
  return admin.from("partners").select("profile_id").eq("id", partnerId).single();
}

// Revenue query: all completed orders for partner.
export function getCompletedOrders(admin: Admin, partnerId: string) {
  return admin
    .from("orders")
    .select("id, partner_cut, product_type, created_at, status")
    .eq("partner_id", partnerId)
    .in("status", ["paid", "delivered"]);
}

// Pending orders for partner (paid, no payout yet).
// We find orders that are NOT included in any payout for this partner.
export async function getPendingOrders(admin: Admin, partnerId: string) {
  // Get all payout records for this partner to find which orders have been paid out
  const { data: payoutRows } = await admin
    .from("payouts")
    .select("orders_included")
    .eq("partner_id", partnerId);

  const paidOrderIds = new Set<string>();
  for (const p of payoutRows || []) {
    for (const oid of (p.orders_included as string[] | null) || []) {
      paidOrderIds.add(oid);
    }
  }

  // Get all paid orders for this partner
  const result = await admin
    .from("orders")
    .select("id, partner_cut")
    .eq("partner_id", partnerId)
    .eq("status", "paid");

  // Filter out orders that already have a payout
  if (result.data) {
    result.data = result.data.filter((o) => !paidOrderIds.has(o.id));
  }

  return result;
}

// Recent payouts for partner (from payouts table).
export function getRecentPayouts(admin: Admin, partnerId: string) {
  return admin
    .from("payouts")
    .select("id, amount, status, stripe_transfer_id, created_at")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(10);
}

// Count active partners created by a given user.
export function countActiveByCreator(admin: Admin, createdBy: string) {
  return admin
    .from("partners")
    .select("id", { count: "exact", head: true })
    .eq("created_by", createdBy)
    .eq("status", "active");
}
