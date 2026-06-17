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

// A partner's still-owed (`pending`) payouts — the IOUs left when a transfer
// could not be sent at checkout (no Connect account / transfers capability not
// yet active). Retried once the account becomes payable.
export function listPendingByPartner(admin: Admin, partnerId: string) {
  return admin
    .from("payouts")
    .select("id, amount, order_id, orders_included")
    .eq("partner_id", partnerId)
    .eq("status", "pending");
}

// Flip a pending payout to `sent` after a successful retry transfer. The
// `.eq("status", "pending")` guard makes this a conditional claim: only the
// row that is still pending is updated and returned, so a racing retry that
// already flipped it gets null and skips its audit write (the Stripe
// idempotency key already prevented a second transfer).
export function markPayoutSent(admin: Admin, payoutId: string, transferId: string) {
  return admin
    .from("payouts")
    .update({
      status: "sent",
      stripe_transfer_id: transferId,
      payout_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", payoutId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
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
