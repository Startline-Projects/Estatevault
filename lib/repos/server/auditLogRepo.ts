// Server-side data access for the `audit_log` table.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

export function insertEntry(
  admin: Admin,
  row: {
    action: string;
    resource_type: string;
    resource_id?: string;
    actor_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return admin.from("audit_log").insert(row);
}
