import { createAdminClient } from "@/lib/api/auth";
import type { Database, Json } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type AuditLogInsert = Database["public"]["Tables"]["audit_log"]["Insert"];

type AuditRow = {
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  actor_id?: string | null;
  ip_address?: string | null;
  metadata?: Json | null;
};

export async function insertEntry(admin: Admin, row: AuditRow) {
  const payload: AuditLogInsert = row;
  const { error } = await admin.from("audit_log").insert(payload);
  if (!error) return;

  // Retry once after 200ms
  await new Promise((r) => setTimeout(r, 200));
  const { error: retryErr } = await admin.from("audit_log").insert(payload);
  if (retryErr) {
    console.error("[audit_log] insert failed after retry:", retryErr.message, row);
  }
}

// Most-recent audit entries (B2 dashboard "recent activity").
export function listRecent(admin: Admin, limit = 10) {
  return admin
    .from("audit_log")
    .select("action, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
}

// Recent audit entries for a specific resource (B2 client detail activity).
export function listByResource(admin: Admin, resourceId: string, limit = 20) {
  return admin
    .from("audit_log")
    .select("action, created_at")
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: false })
    .limit(limit);
}
