// Server-side data access for the `profiles` table.
//
// Note: Supabase auth-user creation (`admin.auth.admin.createUser` /
// `listUsers` / `updateUserById`) is the auth API, not a table query, so it
// stays in the route. This repo only owns row-level access to `profiles`.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

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
export function upsert(admin: Admin, row: ProfileInsert) {
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

// The signed-in user's own profile basics (B2: backs GET /api/profile/me).
export function getMeById(admin: Admin, profileId: string) {
  return admin
    .from("profiles")
    .select("id, full_name, email, phone, user_type")
    .eq("id", profileId)
    .maybeSingle();
}

// Self-update of a profile's display name (B2 settings).
export function updateName(admin: Admin, profileId: string, fullName: string) {
  return admin.from("profiles").update({ full_name: fullName }).eq("id", profileId).select("id").maybeSingle();
}

// A sales rep's commission rate (B2 rep commission view).
export function getCommissionRateById(admin: Admin, profileId: string) {
  return admin.from("profiles").select("commission_rate").eq("id", profileId).maybeSingle();
}

// Client settings: contact + notification prefs + email (B2 dashboard settings).
export function getSettingsById(admin: Admin, profileId: string) {
  return admin
    .from("profiles")
    .select("full_name, phone, notification_preferences, email")
    .eq("id", profileId)
    .maybeSingle();
}

// Self-update of profile contact + notification prefs (B2).
export function updateSettings(admin: Admin, profileId: string, patch: ProfileUpdate) {
  return admin.from("profiles").update(patch).eq("id", profileId).select("id").maybeSingle();
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
    .select("id, user_type, managed_by_admin")
    .eq("email", email)
    .maybeSingle();
}

// Profiles (id + name + email) by id set (B2 attorney reviews assembly).
export function listByIds(admin: Admin, ids: string[]) {
  return admin.from("profiles").select("id, full_name, email").in("id", ids);
}
