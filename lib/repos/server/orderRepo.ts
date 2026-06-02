// Server-side data access for the `orders` table — the only place that queries
// it from the API layer. Routes build the row (money fields, product type, etc.)
// and hand it here; this module just moves it in/out of the DB. Money values
// stay in the route by design.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;

type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

// Insert an order, returning its id.
export function insert(admin: Admin, row: OrderInsert) {
  return admin.from("orders").insert(row).select("id").single();
}

// Patch an order by id (e.g. stripe_session_id, quiz_session_id, promo→free).
export function update(admin: Admin, orderId: string, patch: OrderUpdate) {
  return admin.from("orders").update(patch).eq("id", orderId);
}

// Delivered documents whose delivery date is at or before `cutoff`.
// Used by reminder crons to find clients eligible for nudges.
// `delivered_at` lives on `documents`, not `orders`, so we query documents
// and join to orders for client_id / partner_id.
export function findDeliveredBefore(admin: Admin, cutoff: string) {
  return admin
    .from("documents")
    .select("delivered_at, order_id, orders!inner(client_id, partner_id)")
    .eq("status", "delivered")
    .not("delivered_at", "is", null)
    .lte("delivered_at", cutoff)
    .order("delivered_at", { ascending: true })
    .limit(50);
}

// A partner's orders with the client's profile name/email (B2: backs
// GET /api/partner/documents, used by the pro/documents screen).
export function listByPartnerWithClient(admin: Admin, partnerId: string) {
  return admin
    .from("orders")
    .select("id, product_type, status, created_at, client_id, clients(profiles(full_name, email))")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
}
