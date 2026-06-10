// Re-fulfill a paid-but-stuck order (BUG-1 / BUG-13).
//
// Used by the reconcile cron and the admin "Retry fulfillment" action. For an
// order stuck in `pending` (webhook never arrived) or `failed` (generation/
// queue failed), this re-derives the original Stripe Checkout Session and
// re-runs the document-checkout handler. The handler is replay-safe, so this
// will not double-charge partners or create duplicate documents, and it never
// downgrades an attorney-review order out of its locked `review` state.

import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/api/auth";
import { handleDocumentCheckout } from "@/lib/webhooks/stripe/handleDocumentCheckout";

type Admin = ReturnType<typeof createAdminClient>;

export type ReconcileOutcome =
  | { ok: true; action: "refulfilled" }
  | { ok: false; reason: string };

export async function reconcilePaidOrder(
  supabase: Admin,
  orderId: string,
): Promise<ReconcileOutcome> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, stripe_session_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, reason: "order not found" };
  if (!order.stripe_session_id) return { ok: false, reason: "no stripe_session_id on order" };

  // Confirm the money is really in before doing any fulfillment work.
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
  } catch (err) {
    return { ok: false, reason: `stripe retrieve failed: ${err instanceof Error ? err.message : "unknown"}` };
  }

  if (session.payment_status !== "paid") {
    return { ok: false, reason: `session not paid (payment_status=${session.payment_status})` };
  }

  // Re-run the same handler the webhook would have run. Replay guards inside it
  // make this safe to call repeatedly.
  await handleDocumentCheckout(supabase, session, session.metadata || {});
  return { ok: true, action: "refulfilled" };
}
