// Server-side data access for the `referrals` table.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Attorney referrals attributed to a partner, newest first.
export function listByPartner(admin: Admin, partnerId: string) {
  return admin
    .from("referrals")
    .select("id, reason, status, created_at, referral_fee, referral_fee_paid")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
}

// A partner's PAID referral fees since a date (B2 dashboard).
export function listPaidSince(admin: Admin, partnerId: string, sinceIso: string) {
  return admin
    .from("referrals")
    .select("referral_fee")
    .eq("partner_id", partnerId)
    .eq("referral_fee_paid", true)
    .gte("created_at", sinceIso);
}
