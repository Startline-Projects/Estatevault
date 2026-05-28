// Server-side data access for the `orders` table — the only place that queries
// it from the API layer. Routes build the row (money fields, product type, etc.)
// and hand it here; this module just moves it in/out of the DB. Money values
// stay in the route by design.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Insert an order, returning its id.
export function insert(admin: Admin, row: Record<string, unknown>) {
  return admin.from("orders").insert(row).select("id").single();
}

// Patch an order by id (e.g. stripe_session_id, quiz_session_id, promo→free).
export function update(admin: Admin, orderId: string, patch: Record<string, unknown>) {
  return admin.from("orders").update(patch).eq("id", orderId);
}

// Delivered orders whose delivery date is at or before `cutoff`.
// Used by reminder crons to find clients eligible for nudges.
export function findDeliveredBefore(admin: Admin, cutoff: string) {
  return admin
    .from("orders")
    .select("client_id, partner_id, delivered_at")
    .eq("status", "delivered")
    .not("delivered_at", "is", null)
    .lte("delivered_at", cutoff);
}
