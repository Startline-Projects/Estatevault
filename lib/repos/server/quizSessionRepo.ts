// Server-side data access for the `quiz_sessions` table — the only place that
// queries it from the API layer.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Insert a quiz/intake session row.
export function insert(admin: Admin, row: Record<string, unknown>) {
  return admin.from("quiz_sessions").insert(row);
}

// Insert and return the new row id (callers that link it to an order).
export function insertReturningId(admin: Admin, row: Record<string, unknown>) {
  return admin.from("quiz_sessions").insert(row).select("id").single();
}
