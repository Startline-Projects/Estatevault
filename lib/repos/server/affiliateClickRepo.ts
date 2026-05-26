// Server-side data access for the `affiliate_clicks` table.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Most recent unconverted click for an affiliate (the one we attribute to a new order).
export function findLatestUnconverted(admin: Admin, affiliateId: string) {
  return admin
    .from("affiliate_clicks")
    .select("id")
    .eq("affiliate_id", affiliateId)
    .eq("converted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

// Mark a click converted and link it to the order that converted it.
export function markConverted(admin: Admin, id: string, orderId: string) {
  return admin
    .from("affiliate_clicks")
    .update({ converted: true, order_id: orderId })
    .eq("id", id);
}
