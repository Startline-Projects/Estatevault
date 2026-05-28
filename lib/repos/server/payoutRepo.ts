// Server-side data access for `payouts` and `affiliate_payouts` tables.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

export function insertPartnerPayout(admin: Admin, row: Record<string, unknown>) {
  return admin.from("payouts").insert(row);
}

export function insertAffiliatePayout(admin: Admin, row: Record<string, unknown>) {
  return admin.from("affiliate_payouts").insert(row);
}
