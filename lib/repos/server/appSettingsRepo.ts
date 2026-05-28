// Server-side data access for the `app_settings` table.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Fetch a setting's `value` column by key (e.g. `test_promo_code`).
export function getByKey(admin: Admin, key: string) {
  return admin.from("app_settings").select("value").eq("key", key).single();
}

export function upsertByKey(admin: Admin, key: string, value: unknown, updatedBy: string) {
  return admin.from("app_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  });
}
