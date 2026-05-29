// Server-side data access for the `vault_items` table. This is the ONLY place
// that queries that table from the API layer — routes call these functions
// instead of inlining `.from("vault_items")`. Crypto (encrypt/decrypt, DEK)
// stays in the route; this module only moves rows in and out of the DB.
//
// Ownership is structural: every write is scoped by client_id so a route can't
// accidentally update/delete another client's row.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type VaultItemInsert = Database["public"]["Tables"]["vault_items"]["Insert"];
type VaultItemUpdate = Database["public"]["Tables"]["vault_items"]["Update"];

// List a client's items, newest first. Owner-scoped.
export function listByClient(admin: Admin, clientId: string) {
  return admin
    .from("vault_items")
    .select("id, category, ciphertext, storage_path, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
}

// Insert a new (encrypted) item; returns its id.
export function insert(admin: Admin, row: VaultItemInsert) {
  return admin.from("vault_items").insert(row).select("id").single();
}

// Fetch one item's owner + ciphertext, for an ownership check before mutating.
export function getOwnerAndCiphertext(admin: Admin, id: string) {
  return admin.from("vault_items").select("client_id, ciphertext").eq("id", id).single();
}

// Fetch one item's owner + data column (used by the document-download route).
export function getOwnerAndData(admin: Admin, id: string) {
  return admin.from("vault_items").select("client_id, data").eq("id", id).single();
}

// Update an item, scoped to its owner.
export function updateForOwner(admin: Admin, id: string, clientId: string, update: VaultItemUpdate) {
  return admin.from("vault_items").update(update).eq("id", id).eq("client_id", clientId);
}

// Delete an item, scoped to its owner.
export function deleteForOwner(admin: Admin, id: string, clientId: string) {
  return admin.from("vault_items").delete().eq("id", id).eq("client_id", clientId);
}

// Find items by blind label index (server-side encrypted search). Owner-scoped.
export function findByLabelBlind(admin: Admin, clientId: string, labelBlindHex: string, category?: string) {
  let q = admin
    .from("vault_items")
    .select("id, category")
    .eq("client_id", clientId)
    .eq("label_blind", labelBlindHex);
  if (category) q = q.eq("category", category);
  return q;
}

// ---- E2EE backfill (migrate legacy plaintext rows to ciphertext) ----

// Count not-yet-encrypted, user-authored items for a client.
export function countUnencrypted(admin: Admin, clientId: string) {
  return admin
    .from("vault_items")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("ciphertext", null)
    .not("label", "is", null)
    .eq("auto_generated", false);
}

// Fetch a page of not-yet-encrypted items (plaintext columns) to encrypt.
export function fetchUnencrypted(admin: Admin, clientId: string, limit: number) {
  return admin
    .from("vault_items")
    .select("id, category, label, data")
    .eq("client_id", clientId)
    .is("ciphertext", null)
    .not("label", "is", null)
    .eq("auto_generated", false)
    .order("created_at", { ascending: true })
    .limit(limit);
}

// Persist the encrypted form of one row. Idempotent + owner-scoped: only writes
// when ciphertext is still NULL and the row belongs to the client.
export function encryptRow(admin: Admin, id: string, clientId: string, update: VaultItemUpdate) {
  return admin
    .from("vault_items")
    .update(update, { count: "exact" })
    .eq("id", id)
    .eq("client_id", clientId)
    .is("ciphertext", null);
}
