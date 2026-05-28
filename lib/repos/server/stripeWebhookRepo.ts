// Server-side data access for `stripe_webhook_events` — idempotency guard.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Returns the inserted row if this is a new event, or null if duplicate.
export function checkIdempotency(admin: Admin, eventId: string, eventType: string) {
  return admin
    .from("stripe_webhook_events")
    .insert({ event_id: eventId, event_type: eventType })
    .select("event_id")
    .maybeSingle();
}
