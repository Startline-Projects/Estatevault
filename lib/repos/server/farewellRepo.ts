// Server-side data access for the `farewell_messages` table — the only place
// that queries it from the API layer. Crypto stays in the route; this module
// moves rows. Owner-mutations are scoped by client_id.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type FarewellInsert = Database["public"]["Tables"]["farewell_messages"]["Insert"];
type FarewellUpdate = Database["public"]["Tables"]["farewell_messages"]["Update"];

const HIDDEN_STATUSES = '("deleted","replaced","expired")';

// List a client's active (non-deleted/replaced/expired) messages, newest first.
export function listActiveByClient(admin: Admin, clientId: string) {
  return admin
    .from("farewell_messages")
    .select("id, ciphertext, file_size_mb, duration_seconds, vault_farewell_status, created_at, updated_at, storage_path")
    .eq("client_id", clientId)
    .not("vault_farewell_status", "in", HIDDEN_STATUSES)
    .order("created_at", { ascending: false });
}

// Insert a new (encrypted) message; returns its id.
export function insert(admin: Admin, row: FarewellInsert) {
  return admin.from("farewell_messages").insert(row).select("id").single();
}

// Fetch a message's status + ciphertext for an owner, before editing.
export function getForOwner(admin: Admin, messageId: string, clientId: string) {
  return admin
    .from("farewell_messages")
    .select("id, vault_farewell_status, ciphertext")
    .eq("id", messageId)
    .eq("client_id", clientId)
    .single();
}

// Fetch a message's status + storage path for an owner, before deleting.
export function getOwnerStatusPath(admin: Admin, messageId: string, clientId: string) {
  return admin
    .from("farewell_messages")
    .select("id, vault_farewell_status, storage_path")
    .eq("id", messageId)
    .eq("client_id", clientId)
    .single();
}

// Confirm a message belongs to a client (id-only), e.g. on upload completion.
export function getIdForOwner(admin: Admin, messageId: string, clientId: string) {
  return admin
    .from("farewell_messages")
    .select("id")
    .eq("id", messageId)
    .eq("client_id", clientId)
    .single();
}

// Fetch a single message by id (owner check is applied by the caller — the
// signed-url route serves unlocked messages to non-owners too).
export function getById(admin: Admin, messageId: string) {
  return admin
    .from("farewell_messages")
    .select("id, storage_path, vault_farewell_status, client_id")
    .eq("id", messageId)
    .single();
}

// Find the owner of a stored object by its storage path (path-scoping check).
export function findByStoragePath(admin: Admin, storagePath: string) {
  return admin
    .from("farewell_messages")
    .select("client_id")
    .eq("storage_path", storagePath)
    .maybeSingle();
}

// Update a message, scoped to its owner.
export function updateForOwner(admin: Admin, messageId: string, clientId: string, update: FarewellUpdate) {
  return admin
    .from("farewell_messages")
    .update(update)
    .eq("id", messageId)
    .eq("client_id", clientId);
}

// ---- E2EE backfill ----

export function countUnencrypted(admin: Admin, clientId: string) {
  return admin
    .from("farewell_messages")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("ciphertext", null)
    .neq("title", "");
}

export function fetchUnencrypted(admin: Admin, clientId: string, limit: number) {
  return admin
    .from("farewell_messages")
    .select("id, title, recipient_email")
    .eq("client_id", clientId)
    .is("ciphertext", null)
    .neq("title", "")
    .order("created_at", { ascending: true })
    .limit(limit);
}

export function encryptRow(admin: Admin, id: string, clientId: string, update: FarewellUpdate) {
  return admin
    .from("farewell_messages")
    .update(update, { count: "exact" })
    .eq("id", id)
    .eq("client_id", clientId)
    .is("ciphertext", null);
}
