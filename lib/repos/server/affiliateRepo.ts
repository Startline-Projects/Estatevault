// Server-side data access for the `affiliates` table.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type AffiliatePayoutInsert = Database["public"]["Tables"]["affiliate_payouts"]["Insert"];

type Admin = ReturnType<typeof createAdminClient>;

// Look up an affiliate's status (test-promo attribution path).
export function findStatusById(admin: Admin, id: string) {
  return admin.from("affiliates").select("id, status").eq("id", id).maybeSingle();
}

// Look up an affiliate's payout-readiness (real checkout path).
export function findPayoutStateById(admin: Admin, id: string) {
  return admin
    .from("affiliates")
    .select("id, status, stripe_onboarding_complete")
    .eq("id", id)
    .maybeSingle();
}

// Stripe account + onboarding status for affiliate payout (webhook).
export function getStripeAccountById(admin: Admin, id: string) {
  return admin
    .from("affiliates")
    .select("stripe_account_id, stripe_onboarding_complete")
    .eq("id", id)
    .single();
}

// Increment affiliate stats via RPC after a conversion.
export function incrementStats(admin: Admin, affiliateId: string, earnedCents: number) {
  return admin.rpc("increment_affiliate_stats", {
    p_affiliate_id: affiliateId,
    p_earned_cents: earnedCents,
  });
}

// Full payout info (Stripe account + onboarding status).
export function getPayoutInfoById(admin: Admin, id: string) {
  return admin
    .from("affiliates")
    .select("id, stripe_account_id, stripe_onboarding_complete")
    .eq("id", id)
    .single();
}

// All non-pending orders attributed to an affiliate (for payout calculation).
export function getAttributedOrders(admin: Admin, affiliateId: string) {
  return admin
    .from("orders")
    .select("id, affiliate_cut, status")
    .eq("affiliate_id", affiliateId)
    .neq("status", "pending");
}

// Prior payouts for an affiliate (to calculate already-covered balance).
export function getPriorPayouts(admin: Admin, affiliateId: string) {
  return admin
    .from("affiliate_payouts")
    .select("amount_cents, status")
    .eq("affiliate_id", affiliateId);
}

// Record a payout.
export function insertPayout(admin: Admin, row: AffiliatePayoutInsert) {
  return admin.from("affiliate_payouts").insert(row);
}

// Update affiliate status.
export function updateStatus(admin: Admin, id: string, status: string) {
  return admin.from("affiliates").update({ status }).eq("id", id);
}

// Get affiliate with current status.
export function getWithStatus(admin: Admin, id: string) {
  return admin.from("affiliates").select("id, status").eq("id", id).single();
}
