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

// A partner's orders since a date (partner_cut + status) for month-to-date
// dashboard math (B2).
export function listSinceByPartner(admin: Admin, partnerId: string, sinceIso: string) {
  return admin
    .from("orders")
    .select("partner_cut, status, created_at")
    .eq("partner_id", partnerId)
    .gte("created_at", sinceIso);
}

// All orders for a client, newest first (B2 client detail).
export function listByClient(admin: Admin, clientId: string) {
  return admin
    .from("orders")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
}

// A client's latest order (B2 client documents view).
export function latestByClient(admin: Admin, clientId: string) {
  return admin
    .from("orders")
    .select("id, product_type, status, attorney_review_requested")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1);
}

// Orders by id set (B2 attorney reviews/pipeline assembly).
export function listByIds(admin: Admin, ids: string[]) {
  return admin.from("orders").select("id, product_type, client_id, partner_id").in("id", ids);
}

// Active MTD orders for a set of partners (B2 sales dashboard revenue).
export function listMtdByPartnerIds(admin: Admin, partnerIds: string[], sinceIso: string) {
  return admin
    .from("orders")
    .select("ev_cut, partner_cut, partner_id, status")
    .in("partner_id", partnerIds)
    .in("status", ["paid", "delivered", "generating", "review"])
    .gte("created_at", sinceIso);
}

// MTD orders (amount_total) for a set of partners (B2 pro/sales overview).
export function listMtdAmountByPartnerIds(admin: Admin, partnerIds: string[], sinceIso: string) {
  return admin
    .from("orders")
    .select("amount_total, partner_id")
    .in("partner_id", partnerIds)
    .gte("created_at", sinceIso);
}

// Orders (amount_total + date) since a date for a set of partners (B2 commission history).
export function listSinceDatedByPartnerIds(admin: Admin, partnerIds: string[], sinceIso: string) {
  return admin
    .from("orders")
    .select("amount_total, partner_id, created_at")
    .in("partner_id", partnerIds)
    .gte("created_at", sinceIso);
}

// Active orders (revenue-eligible statuses) for a partner (B2 revenue page).
export function listActiveByPartner(admin: Admin, partnerId: string) {
  return admin
    .from("orders")
    .select("id, client_id, product_type, partner_cut, status, created_at")
    .eq("partner_id", partnerId)
    .in("status", ["paid", "delivered", "generating", "review"]);
}

// Paid-status orders (partner_cut + created_at) for a partner — the route slices
// these into MTD/last-month/all-time/6-month buckets (B2 sales partner-detail).
export function listPaidByPartner(admin: Admin, partnerId: string) {
  return admin
    .from("orders")
    .select("partner_cut, created_at")
    .eq("partner_id", partnerId)
    .in("status", ["paid", "delivered", "generating", "review"]);
}
