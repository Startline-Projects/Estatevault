// Server-side data access for the `clients` table — the account/crypto record
// for an end client. requireClientUser already loads the full row for vault
// routes; these helpers cover the narrow ad-hoc reads other routes need so they
// stop inlining `.from("clients")`.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

// Whether a client still has paid vault access. A cancelled subscription keeps
// access until its paid term ends (Stripe `cancel_at_period_end`): the gates
// must honor `vault_subscription_expiry`, not just the `active` status, or a
// mid-period cancel would revoke months the customer already paid for (BUG-5).
export function hasVaultAccess(
  status: string | null | undefined,
  expiry: string | null | undefined,
): boolean {
  if (status === "active") return true;
  if (status === "cancelled" && expiry) return new Date(expiry).getTime() > Date.now();
  return false;
}

// Subscription status + expiry for a known client id.
export function getSubscriptionById(admin: Admin, clientId: string) {
  return admin
    .from("clients")
    .select("vault_subscription_status, vault_subscription_expiry")
    .eq("id", clientId)
    .single();
}

// Resolve a client (id + subscription + expiry) from its owning auth profile.
export function findIdAndSubByProfile(admin: Admin, profileId: string) {
  return admin
    .from("clients")
    .select("id, vault_subscription_status, vault_subscription_expiry")
    .eq("profile_id", profileId)
    .single();
}

// Variant that returns null instead of erroring when the row is missing.
export function findIdAndSubByProfileMaybe(admin: Admin, profileId: string) {
  return admin
    .from("clients")
    .select("id, vault_subscription_status, vault_subscription_expiry")
    .eq("profile_id", profileId)
    .maybeSingle();
}

// Resolve a client (id + subscription + partner) from its owning auth profile.
export function findWithPartnerByProfile(admin: Admin, profileId: string) {
  return admin
    .from("clients")
    .select("id, vault_subscription_status, partner_id")
    .eq("profile_id", profileId)
    .single();
}

// Just the client id for a profile.
export function getIdByProfile(admin: Admin, profileId: string) {
  return admin.from("clients").select("id").eq("profile_id", profileId).single();
}

// E2EE backfill bootstrap state for a profile.
export function getBackfillStateByProfile(admin: Admin, profileId: string) {
  return admin
    .from("clients")
    .select("id, crypto_setup_at, crypto_backfill_complete_at")
    .eq("profile_id", profileId)
    .single();
}

// Stamp the moment a client's backfill is observed complete.
export function markBackfillComplete(admin: Admin, clientId: string) {
  return admin
    .from("clients")
    .update({ crypto_backfill_complete_at: new Date().toISOString() })
    .eq("id", clientId);
}

// Key material + owner profile for a client id (used to decrypt on their behalf,
// e.g. the trustee-acceptance email under the server-managed model).
export function getKeyMaterialById(admin: Admin, clientId: string) {
  return admin
    .from("clients")
    .select("id, wrapped_dek, profile_id")
    .eq("id", clientId)
    .single();
}

// Insert a new client row (checkout flows that bootstrap an account).
export function create(admin: Admin, row: ClientInsert) {
  return admin.from("clients").insert(row).select("id").single();
}

// Variant returning the subscription status + expiry alongside the id.
export function createReturningWithSub(admin: Admin, row: ClientInsert) {
  return admin.from("clients").insert(row).select("id, vault_subscription_status, vault_subscription_expiry").single();
}

// Link an existing client row to a profile after the auth user is created.
export function setProfileId(admin: Admin, clientId: string, profileId: string) {
  return admin.from("clients").update({ profile_id: profileId }).eq("id", clientId);
}

// Reminder-cron state: profile link + last-sent timestamps.
export function getReminderStateById(admin: Admin, clientId: string) {
  return admin
    .from("clients")
    .select("profile_id, last_annual_review_sent_at, last_life_event_checkin_sent_at")
    .eq("id", clientId)
    .maybeSingle();
}

export function stampAnnualReview(admin: Admin, clientId: string) {
  return admin
    .from("clients")
    .update({ last_annual_review_sent_at: new Date().toISOString() })
    .eq("id", clientId);
}

export function stampLifeEventCheckin(admin: Admin, clientId: string) {
  return admin
    .from("clients")
    .update({ last_life_event_checkin_sent_at: new Date().toISOString() })
    .eq("id", clientId);
}

// Cancelled vault subscriptions whose paid term ends within a window (expiry in
// (now, now+windowDays]). Backs the expiry-reminder cron so we can warn the
// owner to export their assets or resubscribe before access ends.
export function findExpiringCancelled(admin: Admin, nowIso: string, untilIso: string) {
  return admin
    .from("clients")
    .select("id, profile_id, partner_id, vault_subscription_expiry")
    .eq("vault_subscription_status", "cancelled")
    .gt("vault_subscription_expiry", nowIso)
    .lte("vault_subscription_expiry", untilIso);
}

// Find a client by vault Stripe subscription ID (webhook renewal/failure/deletion).
export function findBySubscriptionId(admin: Admin, subscriptionId: string) {
  return admin
    .from("clients")
    .select("id, profile_id")
    .eq("vault_subscription_stripe_id", subscriptionId)
    .single();
}

// Update vault subscription fields.
export function updateVaultSubscription(
  admin: Admin,
  clientId: string,
  patch: ClientUpdate,
) {
  return admin.from("clients").update(patch).eq("id", clientId);
}

// Activate vault subscription by Stripe subscription ID.
export function activateVaultByStripeId(
  admin: Admin,
  subscriptionId: string,
  expiry: string,
) {
  return admin
    .from("clients")
    .update({ vault_subscription_status: "active", vault_subscription_expiry: expiry })
    .eq("vault_subscription_stripe_id", subscriptionId);
}

// Cancel vault subscription by Stripe subscription ID.
export function cancelVaultByStripeId(admin: Admin, subscriptionId: string) {
  return admin
    .from("clients")
    .update({ vault_subscription_status: "cancelled", vault_subscription_stripe_id: null })
    .eq("vault_subscription_stripe_id", subscriptionId);
}

// Find client by profile ID (returns id only).
export function findByProfileId(admin: Admin, profileId: string) {
  return admin
    .from("clients")
    .select("id")
    .eq("profile_id", profileId)
    .single();
}

// Client id + owning partner for a profile (B2 login whitelabel lockout).
export function getPartnerIdByProfile(admin: Admin, profileId: string) {
  return admin
    .from("clients")
    .select("id, partner_id")
    .eq("profile_id", profileId)
    .not("partner_id", "is", null)
    .limit(1)
    .maybeSingle();
}

// Client id + funding checklist for a profile (B2 funding checklist screen).
export function getFundingByProfile(admin: Admin, profileId: string) {
  return admin
    .from("clients")
    .select("id, funding_checklist")
    .eq("profile_id", profileId)
    .maybeSingle();
}

// Update a client's funding checklist, scoped to its owning profile (B2).
export function updateFundingByProfile(
  admin: Admin,
  profileId: string,
  checklist: Record<string, boolean>,
) {
  return admin
    .from("clients")
    .update({ funding_checklist: checklist })
    .eq("profile_id", profileId)
    .select("id")
    .maybeSingle();
}

// Advisor-sharing fields for a profile (B2 client settings).
export function getAdvisorByProfile(admin: Admin, profileId: string) {
  return admin
    .from("clients")
    .select("advisor_name, advisor_firm, advisor_share_consent")
    .eq("profile_id", profileId)
    .maybeSingle();
}

// Update advisor-sharing fields, scoped to the owning profile (B2).
export function updateAdvisorByProfile(admin: Admin, profileId: string, patch: ClientUpdate) {
  return admin.from("clients").update(patch).eq("profile_id", profileId).select("id").maybeSingle();
}

// A partner's clients with their profile + order summaries (B2: backs the
// GET on /api/partner/clients, used by the pro/clients screen).
export function listByPartnerWithOrders(admin: Admin, partnerId: string) {
  return admin
    .from("clients")
    .select("id, profile_id, created_at, profiles(full_name, email), orders(product_type, status, partner_cut)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
}

// Count of a partner's clients (B2 dashboard). head:true = count only, no rows.
export function countByPartner(admin: Admin, partnerId: string) {
  return admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);
}

// Count of a partner's clients with an active vault subscription (B2 dashboard).
export function countActiveVaultByPartner(admin: Admin, partnerId: string) {
  return admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("vault_subscription_status", "active");
}

// A partner's vault-subscription clients (B2: backs GET /api/partner/vault-clients).
export function listVaultClientsByPartner(admin: Admin, partnerId: string) {
  return admin
    .from("clients")
    .select("id, profile_id, created_at, vault_subscription_status, profiles(full_name, email)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
}

// Single client detail (id + owning partner + profile) for the pro client
// detail page (B2). The route verifies partner ownership against partner_id.
export function getDetailById(admin: Admin, clientId: string) {
  return admin
    .from("clients")
    .select("id, partner_id, created_at, profiles(full_name, email, phone)")
    .eq("id", clientId)
    .single();
}

// A client's CRM notes, newest first (B2).
export function listNotes(admin: Admin, clientId: string) {
  return admin
    .from("client_notes")
    .select("id, note, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
}

// Clients (id + profile) by id set (B2 attorney reviews assembly).
export function listByIds(admin: Admin, ids: string[]) {
  return admin.from("clients").select("id, profile_id").in("id", ids);
}

// Active-vault clients (raw subscription fields) for a partner (B2 revenue synthesis).
export function listActiveVaultRaw(admin: Admin, partnerId: string) {
  return admin
    .from("clients")
    .select("id, vault_subscription_status, vault_subscription_expiry, updated_at, created_at")
    .eq("partner_id", partnerId)
    .eq("vault_subscription_status", "active");
}
