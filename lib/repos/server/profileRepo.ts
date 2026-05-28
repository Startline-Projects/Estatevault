// Server-side data access for the `profiles` table.
//
// Note: Supabase auth-user creation (`admin.auth.admin.createUser` /
// `listUsers` / `updateUserById`) is the auth API, not a table query, so it
// stays in the route. This repo only owns row-level access to `profiles`.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Look up a profile id by email (used by promo-free account-creation paths).
export function findIdByEmail(admin: Admin, email: string) {
  return admin.from("profiles").select("id").eq("email", email).single();
}

// Variant that returns null instead of erroring when the row is missing.
export function findIdByEmailMaybe(admin: Admin, email: string) {
  return admin.from("profiles").select("id").eq("email", email).maybeSingle();
}

// Profile id + display name for an email (post-checkout verify lookup).
export function findIdAndNameByEmail(admin: Admin, email: string) {
  return admin.from("profiles").select("id, full_name").eq("email", email).single();
}

// Upsert a profile row.
export function upsert(admin: Admin, row: Record<string, unknown>) {
  return admin.from("profiles").upsert(row);
}

// Email + display name for a known profile id (used by reminder crons).
export function getEmailAndNameById(admin: Admin, profileId: string) {
  return admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", profileId)
    .maybeSingle();
}

// All sales rep profiles (for sales admin listing).
export function findAllSalesReps(admin: Admin) {
  return admin
    .from("profiles")
    .select("id, full_name, email, created_at, commission_rate")
    .eq("user_type", "sales_rep")
    .order("created_at", { ascending: false });
}

// Update commission rate for a sales rep.
export function updateCommissionRate(admin: Admin, repId: string, rate: number) {
  return admin
    .from("profiles")
    .update({ commission_rate: rate })
    .eq("id", repId)
    .eq("user_type", "sales_rep");
}

// Find profile by email (maybe null).
export function findByEmail(admin: Admin, email: string) {
  return admin
    .from("profiles")
    .select("id, user_type")
    .eq("email", email)
    .maybeSingle();
}
