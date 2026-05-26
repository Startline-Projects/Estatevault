// Server-side data access for the `partners` table — the only place that queries
// it from the API layer.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Revenue tier for a partner id (drives the EV/partner split).
export function getTier(admin: Admin, partnerId: string) {
  return admin.from("partners").select("tier").eq("id", partnerId).single();
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
export function update(admin: Admin, partnerId: string, patch: Record<string, unknown>) {
  return admin.from("partners").update(patch).eq("id", partnerId);
}

// Insert a new partner row.
export function insert(admin: Admin, row: Record<string, unknown>) {
  return admin.from("partners").insert(row);
}

// Upsert a partner row (attorney signup retry flows).
export function upsert(admin: Admin, row: Record<string, unknown>) {
  return admin.from("partners").upsert(row);
}
