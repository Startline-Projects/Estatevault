// Server-side data access for `sales_prospects` + `sales_prospect_activity`.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;
type ProspectInsert = Database["public"]["Tables"]["sales_prospects"]["Insert"];
type ProspectUpdate = Database["public"]["Tables"]["sales_prospects"]["Update"];
type ActivityInsert = Database["public"]["Tables"]["sales_prospect_activity"]["Insert"];

// A rep's prospects, newest first (B2 pipeline).
export function listByRep(admin: Admin, repId: string) {
  return admin
    .from("sales_prospects")
    .select("*")
    .eq("sales_rep_id", repId)
    .order("created_at", { ascending: false });
}

export function insert(admin: Admin, row: ProspectInsert) {
  return admin.from("sales_prospects").insert(row).select("id").single();
}

// Update a prospect, scoped to the owning rep.
export function updateForRep(admin: Admin, id: string, repId: string, patch: ProspectUpdate) {
  return admin
    .from("sales_prospects")
    .update(patch)
    .eq("id", id)
    .eq("sales_rep_id", repId)
    .select("id")
    .maybeSingle();
}

// Delete a prospect, scoped to the owning rep.
export function deleteForRep(admin: Admin, id: string, repId: string) {
  return admin
    .from("sales_prospects")
    .delete()
    .eq("id", id)
    .eq("sales_rep_id", repId)
    .select("id")
    .maybeSingle();
}

// Ownership check: a prospect by id that belongs to the rep.
export function getOwnedById(admin: Admin, id: string, repId: string) {
  return admin
    .from("sales_prospects")
    .select("id")
    .eq("id", id)
    .eq("sales_rep_id", repId)
    .maybeSingle();
}

// Activity log for a prospect, newest first.
export function listActivity(admin: Admin, prospectId: string) {
  return admin
    .from("sales_prospect_activity")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false });
}

export function insertActivity(admin: Admin, row: ActivityInsert) {
  return admin.from("sales_prospect_activity").insert(row);
}
