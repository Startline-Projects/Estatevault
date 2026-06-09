// Server-side data access for `payouts` and `affiliate_payouts` tables.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type PayoutInsert = Database["public"]["Tables"]["payouts"]["Insert"];
type AffiliatePayoutInsert = Database["public"]["Tables"]["affiliate_payouts"]["Insert"];

export function insertPartnerPayout(admin: Admin, row: PayoutInsert) {
  return admin.from("payouts").insert(row);
}

// Insert an affiliate payout, returning the inserted row (or null on a unique
// conflict — see the affiliate_payouts(orders_included) index from BUG-23).
// Callers gate the irreversible stats counter on a non-null result so a
// concurrent replay that loses the insert race does not double-count.
export function insertAffiliatePayout(admin: Admin, row: AffiliatePayoutInsert) {
  return admin.from("affiliate_payouts").insert(row).select("id").maybeSingle();
}

// A partner's payouts (with orders_included) for the revenue page (B2).
export function listByPartner(admin: Admin, partnerId: string) {
  return admin
    .from("payouts")
    .select("id, amount, status, orders_included, created_at")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(20);
}
