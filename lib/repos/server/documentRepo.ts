// Server-side data access for the `documents` table.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];

export function insertMany(admin: Admin, rows: DocumentInsert[]) {
  return admin.from("documents").insert(rows);
}

export function updateStatusByType(
  admin: Admin,
  orderId: string,
  docType: string,
  status: string,
  extra?: DocumentUpdate,
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

// A client's documents (B2 client detail).
export function listByClient(admin: Admin, clientId: string) {
  return admin
    .from("documents")
    .select("id, document_type, status, created_at")
    .eq("client_id", clientId);
}
