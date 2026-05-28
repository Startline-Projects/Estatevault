// Server-side data access for `attorney_reviews` table.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

export function insert(admin: Admin, row: Record<string, unknown>) {
  return admin.from("attorney_reviews").insert(row);
}

export function getById(admin: Admin, id: string) {
  return admin
    .from("attorney_reviews")
    .select("id, order_id, attorney_id, status, sla_deadline, created_at, partner_id")
    .eq("id", id)
    .single();
}

export function updateDecision(admin: Admin, id: string, decision: string, notes: string | null) {
  return admin
    .from("attorney_reviews")
    .update({ status: decision, notes, reviewed_at: new Date().toISOString() })
    .eq("id", id);
}

export function findOverdue(admin: Admin) {
  return admin
    .from("attorney_reviews")
    .select("id, order_id, attorney_id, sla_deadline")
    .in("status", ["pending", "in_review"])
    .lt("sla_deadline", new Date().toISOString());
}

export function isAssignedAttorney(admin: Admin, orderId: string, userId: string) {
  return admin
    .from("attorney_reviews")
    .select("id")
    .eq("order_id", orderId)
    .eq("attorney_id", userId)
    .maybeSingle();
}

export function getReviewWithOrder(admin: Admin, reviewId: string) {
  return admin
    .from("attorney_reviews")
    .select("order_id, orders(product_type, client_id, partner_id, clients(profiles(email)))")
    .eq("id", reviewId)
    .single();
}
