// Server-side data access for the `documents` table.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

export function insertMany(admin: Admin, rows: Array<Record<string, unknown>>) {
  return admin.from("documents").insert(rows);
}

export function updateStatusByType(
  admin: Admin,
  orderId: string,
  docType: string,
  status: string,
  extra?: Record<string, unknown>,
) {
  return admin
    .from("documents")
    .update({ status, ...extra })
    .eq("order_id", orderId)
    .eq("document_type", docType);
}

export function countByStatus(admin: Admin, orderId: string, status: string) {
  return admin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("status", status);
}
