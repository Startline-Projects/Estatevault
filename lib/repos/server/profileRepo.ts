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
