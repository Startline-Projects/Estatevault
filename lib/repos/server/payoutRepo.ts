// Server-side data access for `payouts` and `affiliate_payouts` tables.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type PayoutInsert = Database["public"]["Tables"]["payouts"]["Insert"];
type AffiliatePayoutInsert = Database["public"]["Tables"]["affiliate_payouts"]["Insert"];

export function insertPartnerPayout(admin: Admin, row: PayoutInsert) {
  return admin.from("payouts").insert(row);
}

export function insertAffiliatePayout(admin: Admin, row: AffiliatePayoutInsert) {
  return admin.from("affiliate_payouts").insert(row);
}
