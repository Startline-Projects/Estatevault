// Server-side data access for the `clients` table — the account/crypto record
// for an end client. requireClientUser already loads the full row for vault
// routes; these helpers cover the narrow ad-hoc reads other routes need so they
// stop inlining `.from("clients")`.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Subscription status for a known client id.
export function getSubscriptionById(admin: Admin, clientId: string) {
  return admin
    .from("clients")
    .select("vault_subscription_status")
    .eq("id", clientId)
    .single();
}

// Resolve a client (id + subscription) from its owning auth profile.
export function findIdAndSubByProfile(admin: Admin, profileId: string) {
  return admin
    .from("clients")
    .select("id, vault_subscription_status")
    .eq("profile_id", profileId)
    .single();
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
