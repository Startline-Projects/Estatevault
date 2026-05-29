// Server-side data access for the `vault_trustees` table — the only place that
// queries it from the API layer. Crypto stays in the route; this module moves
// rows. Owner-mutations are scoped by client_id. The confirm-by-token path is
// keyed on the unguessable invite_token (that token is the authorization).

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type TrusteeInsert = Database["public"]["Tables"]["vault_trustees"]["Insert"];
type TrusteeUpdate = Database["public"]["Tables"]["vault_trustees"]["Update"];

// List a client's trustees (encrypted blob + status fields).
export function listByClient(admin: Admin, clientId: string) {
  return admin
    .from("vault_trustees")
    .select("id, ciphertext, status, invite_sent_at, confirmed_at, access_scope")
    .eq("client_id", clientId);
}

// Existing trustee ids for a client (used for the max-2 cap).
export function listIdsByClient(admin: Admin, clientId: string) {
  return admin.from("vault_trustees").select("id").eq("client_id", clientId);
}

// Duplicate check by blind email index.
export function findByEmailBlind(admin: Admin, clientId: string, emailBlindHex: string) {
  return admin
    .from("vault_trustees")
    .select("id")
    .eq("client_id", clientId)
    .eq("email_blind", emailBlindHex)
    .limit(1);
}

// Insert a new (encrypted) trustee row.
export function insert(admin: Admin, row: TrusteeInsert) {
  return admin.from("vault_trustees").insert(row);
}

// Look up a trustee by its invite token (the confirm link).
export function findByInviteToken(admin: Admin, token: string) {
  return admin
    .from("vault_trustees")
    .select("id, status, client_id, ciphertext")
    .eq("invite_token", token)
    .single();
}

// Mark a trustee active (called from the token-confirm flow).
export function markActive(admin: Admin, id: string) {
  return admin
    .from("vault_trustees")
    .update({ status: "active", confirmed_at: new Date().toISOString() })
    .eq("id", id);
}

// Delete a trustee, scoped to its owner. Returns an exact count.
export function deleteForOwner(admin: Admin, id: string, clientId: string) {
  return admin
    .from("vault_trustees")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("client_id", clientId);
}

// ---- E2EE backfill ----

export function countUnencrypted(admin: Admin, clientId: string) {
  return admin
    .from("vault_trustees")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("ciphertext", null)
    .neq("trustee_email", "");
}

export function fetchUnencrypted(admin: Admin, clientId: string, limit: number) {
  return admin
    .from("vault_trustees")
    .select("id, trustee_name, trustee_email, trustee_relationship")
    .eq("client_id", clientId)
    .is("ciphertext", null)
    .neq("trustee_email", "")
    .order("created_at", { ascending: true })
    .limit(limit);
}

export function encryptRow(admin: Admin, id: string, clientId: string, update: TrusteeUpdate) {
  return admin
    .from("vault_trustees")
    .update(update, { count: "exact" })
    .eq("id", id)
    .eq("client_id", clientId)
    .is("ciphertext", null);
}
