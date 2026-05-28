import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

type AuditRow = {
  action: string;
  resource_type: string;
  resource_id?: string;
  actor_id?: string | null;
  metadata?: Record<string, unknown>;
};

export async function insertEntry(admin: Admin, row: AuditRow) {
  const { error } = await admin.from("audit_log").insert(row);
  if (!error) return;

  // Retry once after 200ms
  await new Promise((r) => setTimeout(r, 200));
  const { error: retryErr } = await admin.from("audit_log").insert(row);
  if (retryErr) {
    console.error("[audit_log] insert failed after retry:", retryErr.message, row);
  }
}
