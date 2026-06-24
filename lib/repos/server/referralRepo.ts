// Server-side data access for the `referrals` table.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;
type ReferralInsert = Database["public"]["Tables"]["referrals"]["Insert"];

// Attorney referrals attributed to a partner, newest first.
export function listByPartner(admin: Admin, partnerId: string) {
  return admin
    .from("referrals")
    .select(
      "id, reason, status, created_at, referral_fee, referral_fee_paid, client_name, client_email",
    )
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

// Create an attorney referral (Core Rule 4 hard-stop routing).
export function insert(admin: Admin, row: ReferralInsert) {
  return admin.from("referrals").insert(row).select("id").single();
}

// An open (still-actionable, unpaid) referral for a partner+client. Used as a
// dedupe guard so repeated hard-stopped checkout attempts by the same client
// never stack duplicate referral rows for the partner.
export function findOpenByPartnerAndClient(
  admin: Admin,
  partnerId: string,
  clientId: string,
) {
  return admin
    .from("referrals")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("client_id", clientId)
    .in("status", ["pending", "contacted"])
    .maybeSingle();
}

// An open referral already logged for this email under the same partner (or
// the no-partner / direct bucket). Dedupe guard so a double-submit / refresh of
// the hard-stop contact form doesn't create duplicate rows.
export function findOpenByEmailAndPartner(
  admin: Admin,
  email: string,
  partnerId: string | null,
) {
  const base = admin
    .from("referrals")
    .select("id")
    .eq("client_email", email)
    .in("status", ["pending", "contacted"]);
  return (partnerId ? base.eq("partner_id", partnerId) : base.is("partner_id", null))
    .limit(1)
    .maybeSingle();
}

// All referrals with partner attribution, newest first (admin management view).
export function listAllForAdmin(admin: Admin) {
  return admin
    .from("referrals")
    .select(
      "id, reason, status, created_at, referral_fee, referral_fee_paid, partner_id, client_name, client_email, client_phone, partners(company_name, stripe_account_id)",
    )
    .order("created_at", { ascending: false });
}

// Every hard-stop referral for the review attorney's lead queue, newest first.
// No fee amount/Stripe fields — the attorney judges the lead; the payout is the
// admin's concern. `referral_fee_paid` is included only so a settled (paid) lead
// can be locked. Contact details let the attorney actually reach out.
export function listAllForAttorney(admin: Admin) {
  return admin
    .from("referrals")
    .select(
      "id, reason, status, created_at, referral_fee_paid, client_name, client_email, client_phone, partners(company_name)",
    )
    .order("created_at", { ascending: false });
}

// Record the attorney's OUTCOME signal on a lead. Maps to the existing status
// CHECK-constraint values: converted → "converted", not_converted → "closed".
// Deliberately never touches referral_fee_paid — the partner's $75 moves only
// when the admin presses pay (markConverted). Returns the new status to confirm.
export function setAttorneyOutcome(
  admin: Admin,
  referralId: string,
  outcome: "converted" | "not_converted",
) {
  const status = outcome === "converted" ? "converted" : "closed";
  return admin
    .from("referrals")
    .update({ status })
    .eq("id", referralId)
    .select("id, status")
    .single();
}

// Single referral with the fields the convert/payout flow needs.
export function getById(admin: Admin, referralId: string) {
  return admin
    .from("referrals")
    .select("id, status, partner_id, referral_fee, referral_fee_paid")
    .eq("id", referralId)
    .single();
}

// Mark a referral converted and credit the partner's referral fee. Returns the
// affected partner_id/fee so the caller can audit-log the payout.
export function markConverted(admin: Admin, referralId: string) {
  return admin
    .from("referrals")
    .update({ status: "converted", referral_fee_paid: true })
    .eq("id", referralId)
    .select("id, partner_id, referral_fee, referral_fee_paid")
    .single();
}
