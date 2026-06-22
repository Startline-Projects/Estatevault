// Server-side data access for `commission_payouts` — the record of commission
// actually paid out to a recipient (sales rep / review attorney) for a month.
// Accessed only via the service-role admin client.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;
type CommissionPayoutInsert = Database["public"]["Tables"]["commission_payouts"]["Insert"];

// All payouts recorded for one recipient (their own commission page maps
// period -> paid).
export function listForRecipient(admin: Admin, recipientId: string) {
  return admin
    .from("commission_payouts")
    .select("period, amount_cents, paid_at")
    .eq("recipient_id", recipientId);
}

// All payouts for a given period (admin overview: which recipients are paid).
export function listForPeriod(admin: Admin, period: string) {
  return admin
    .from("commission_payouts")
    .select("recipient_id, amount_cents, paid_at")
    .eq("period", period);
}

// Record a payout. The unique (recipient_id, period) index makes this
// idempotent: a second mark-paid for the same recipient+period conflicts and
// returns null instead of paying twice. Only the winning insert returns a row.
export function markPaid(admin: Admin, row: CommissionPayoutInsert) {
  return admin
    .from("commission_payouts")
    .upsert(row, { onConflict: "recipient_id,period", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
}
