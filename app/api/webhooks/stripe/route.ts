export const dynamic = "force-dynamic";

import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import { sendDunningEmail } from "@/lib/email";
import * as stripeWebhookRepo from "@/lib/repos/server/stripeWebhookRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import { handleVaultSubscriptionCheckout } from "@/lib/webhooks/stripe/handleVaultSubscriptionCheckout";
import { handleDocumentCheckout } from "@/lib/webhooks/stripe/handleDocumentCheckout";

// Stripe webhook router. Verifies the signature, enforces idempotency, then
// dispatches by event type. The heavy per-product checkout handlers live in
// lib/webhooks/stripe/* — this file stays a thin router.
export const POST = withRoute(async (request: NextRequest) => {
  const body = await request.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return fail("Missing stripe-signature header", 400);
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return fail("Webhook signature verification failed", 400);
  }

  const supabase = createAdminClient();

  // ── IDEMPOTENCY GUARD (two-phase) ──────────────────────────
  // Claim the event as `processing`. Only a previously-COMPLETED event is a
  // true duplicate; a crashed/partial prior attempt is re-run so the order is
  // not left paid-but-unfulfilled (BUG-1).
  const claim = await stripeWebhookRepo.claimEvent(supabase, event.id, event.type);
  if (!claim.proceed) {
    return ok({ received: true, duplicate: true });
  }

  // Dispatch under a commit-after-success guard: mark the event completed only
  // when the handler returns, mark it failed + rethrow when it throws so the
  // route returns 500 and Stripe redelivers (which can now re-run).
  try {
    const response = await dispatchEvent(supabase, event);
    await stripeWebhookRepo.markCompleted(supabase, event.id);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook handler failed for ${event.type} (${event.id}):`, message);
    await stripeWebhookRepo.markFailed(supabase, event.id, message);
    return fail("Webhook handler failed", 500);
  }
});

// Per-event dispatch. Throwing here marks the event failed and triggers a
// Stripe retry; returning marks it completed.
async function dispatchEvent(
  supabase: ReturnType<typeof createAdminClient>,
  event: Stripe.Event,
) {
  // ── VAULT SUBSCRIPTION EVENTS ───────────────────────────────
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.billing_reason === "subscription_cycle") {
      const rawSub = (event.data.object as unknown as Record<string, unknown>).subscription;
      const subscriptionId = typeof rawSub === "string" ? rawSub : null;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        if (sub.status === "active") {
          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
          const expiry = periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
          await clientRepo.activateVaultByStripeId(supabase, subscriptionId, expiry);
          await auditLogRepo.insertEntry(supabase, {
            action: "subscription.renewed",
            resource_type: "client",
            resource_id: subscriptionId,
            metadata: { subscription_id: subscriptionId, stripe_status: sub.status },
          });
        } else {
          console.warn(`[webhook] renewal skipped: sub ${subscriptionId} status=${sub.status}, not active`);
        }
      }
    }
    return ok({ received: true });
  }

  if (event.type === "invoice.payment_failed") {
    const rawSub = (event.data.object as unknown as Record<string, unknown>).subscription;
    const subscriptionId = typeof rawSub === "string" ? rawSub : null;
    if (subscriptionId) {
      const { data: client } = await clientRepo.findBySubscriptionId(supabase, subscriptionId);
      if (client) {
        await clientRepo.updateVaultSubscription(supabase, client.id, {
          vault_subscription_status: "past_due",
        });
        try {
          const { data: profile } = client.profile_id
            ? await profileRepo.getEmailAndNameById(supabase, client.profile_id)
            : { data: null };
          if (profile?.email) {
            await sendDunningEmail({ to: profile.email, fullName: profile.full_name });
          }
        } catch (emailErr) {
          console.error("Dunning email failed:", emailErr);
        }
        await auditLogRepo.insertEntry(supabase, {
          action: "subscription.payment_failed",
          resource_type: "client",
          resource_id: client.id,
        });
      }
    }
    return ok({ received: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await clientRepo.cancelVaultByStripeId(supabase, subscription.id);
    await auditLogRepo.insertEntry(supabase, {
      action: "subscription.deleted",
      resource_type: "client",
      resource_id: subscription.id,
      metadata: { subscription_id: subscription.id },
    });
    return ok({ received: true });
  }

  // ── CHECKOUT SESSION COMPLETED ──────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    // Handle partner platform fee checkout
    if (metadata.type === "partner_platform_fee") {
      const partnerId = metadata.partner_id;
      if (partnerId) {
        // H-6: apply the tier upgrade here, only after payment confirms.
        const paidTier =
          metadata.tier === "enterprise" || metadata.tier === "standard" || metadata.tier === "basic"
            ? metadata.tier
            : undefined;
        await partnerRepo.update(supabase, partnerId, {
          one_time_fee_paid: true,
          onboarding_step: 2,
          platform_fee_amount: session.amount_total || 0,
          ...(paidTier ? { tier: paidTier } : {}),
        });
        await auditLogRepo.insertEntry(supabase, {
          action: "partner.platform_fee_paid",
          resource_type: "partner",
          resource_id: partnerId,
          metadata: { tier: metadata.tier, amount: session.amount_total },
        });
      } else {
        console.error("partner_platform_fee webhook received without partner_id in metadata");
      }
      return ok({ received: true });
    }

    // Handle vault subscription checkout
    if (metadata.product_type === "vault_subscription") {
      await handleVaultSubscriptionCheckout(supabase, session, metadata);
      return ok({ received: true });
    }

    // Handle will/trust checkout
    await handleDocumentCheckout(supabase, session, metadata);
  }

  return ok({ received: true });
}
