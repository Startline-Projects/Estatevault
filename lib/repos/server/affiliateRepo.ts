// Server-side data access for the `affiliates` table.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Look up an affiliate's status (test-promo attribution path).
export function findStatusById(admin: Admin, id: string) {
  return admin.from("affiliates").select("id, status").eq("id", id).maybeSingle();
}

// Look up an affiliate's payout-readiness (real checkout path).
export function findPayoutStateById(admin: Admin, id: string) {
  return admin
    .from("affiliates")
    .select("id, status, stripe_onboarding_complete")
    .eq("id", id)
    .maybeSingle();
}
