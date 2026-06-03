// Server-side data access for the `professional_leads` table.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// New + contacted leads, newest first (B2 sales dashboard).
export function listActive(admin: Admin, limit = 10) {
  return admin
    .from("professional_leads")
    .select("*")
    .in("status", ["new", "contacted"])
    .order("created_at", { ascending: false })
    .limit(limit);
}
