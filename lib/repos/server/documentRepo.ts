// Server-side data access for the `documents` table.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Insert the document records (will/poa/healthcare_directive etc.) for an order.
export function insertMany(admin: Admin, rows: Array<Record<string, unknown>>) {
  return admin.from("documents").insert(rows);
}
