// Server-side data access for `stripe_webhook_events` — idempotency guard.
//
// Two-phase commit (BUG-1): claim the event as `processing` on receipt, then
// mark it `completed` only after the handler succeeds, or `failed` if it throws.
// Only a `completed` row short-circuits a redelivery; `processing`/`failed`
// rows are re-run so a crashed/partial handler can be retried by Stripe instead
// of being silently dropped as a duplicate.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

export type ClaimResult =
  | { proceed: true } // newly claimed, or a prior incomplete attempt we may retry
  | { proceed: false }; // already completed — true duplicate, skip

// Attempt to claim an event for processing. Inserts a `processing` row on first
// sight. On conflict (redelivery), proceed only if the prior attempt did not
// complete.
export async function claimEvent(
  admin: Admin,
  eventId: string,
  eventType: string,
): Promise<ClaimResult> {
  const { data: inserted } = await admin
    .from("stripe_webhook_events")
    .insert({ event_id: eventId, event_type: eventType, status: "processing" })
    .select("event_id")
    .maybeSingle();

  if (inserted) return { proceed: true };

  // Row already exists — inspect its status to decide retry vs skip.
  const { data: existing } = await admin
    .from("stripe_webhook_events")
    .select("status")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing && existing.status !== "completed") {
    // Prior attempt crashed or is mid-flight — allow this redelivery to re-run.
    await admin
      .from("stripe_webhook_events")
      .update({ status: "processing", last_error: null })
      .eq("event_id", eventId);
    return { proceed: true };
  }

  return { proceed: false };
}

export function markCompleted(admin: Admin, eventId: string) {
  return admin
    .from("stripe_webhook_events")
    .update({ status: "completed", completed_at: new Date().toISOString(), last_error: null })
    .eq("event_id", eventId);
}

export function markFailed(admin: Admin, eventId: string, error: string) {
  return admin
    .from("stripe_webhook_events")
    .update({ status: "failed", last_error: error.slice(0, 2000) })
    .eq("event_id", eventId);
}
