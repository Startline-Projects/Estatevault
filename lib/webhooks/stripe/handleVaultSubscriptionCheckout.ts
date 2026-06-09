import Stripe from "stripe";
import { transferToPartner } from "@/lib/stripe-payouts";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as payoutRepo from "@/lib/repos/server/payoutRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import { resolveOrCreateGuestClient } from "./resolveOrCreateGuestClient";
import type { Admin } from "./types";

// Activate a vault subscription from a completed checkout: resolve/create the
// client, mark the subscription active, record the order + revenue split, and
// transfer or queue the partner's cut.
export async function handleVaultSubscriptionCheckout(
  supabase: Admin,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
) {
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  const partnerId = metadata.partner_id || null;

  let clientId = metadata.client_id || null;

  if (!clientId) {
    clientId = await resolveOrCreateGuestClient(supabase, session, metadata, partnerId, "vault");
  }

  if (!clientId) return;

  // Stack onto any remaining paid term: if the client still has unexpired access
  // (a resubscribe before lapse), the new year extends from the current expiry;
  // otherwise it runs a year from now. Mirrors the checkout `trial_end` deferral.
  const { data: current } = await clientRepo.getSubscriptionById(supabase, clientId);
  const currentExpiryMs = current?.vault_subscription_expiry
    ? new Date(current.vault_subscription_expiry).getTime()
    : 0;
  const base = currentExpiryMs > Date.now() ? new Date(currentExpiryMs) : new Date();
  base.setFullYear(base.getFullYear() + 1);
  const expiry = base;

  await clientRepo.updateVaultSubscription(supabase, clientId, {
    vault_subscription_status: "active",
    vault_subscription_expiry: expiry.toISOString(),
    vault_subscription_stripe_id: subscriptionId,
  });
  await auditLogRepo.insertEntry(supabase, {
    action: "subscription.activated",
    resource_type: "client",
    resource_id: clientId,
    metadata: { subscription_id: subscriptionId },
  });

  const amountTotal = session.amount_total || 0;
  let partnerCut = 0;
  let evCut = amountTotal;
  let partnerStripeAccountId: string | null = null;

  if (partnerId) {
    const { data: partner } = await partnerRepo.getStripeAndRevenuePct(supabase, partnerId);
    const pct = Number(partner?.partner_revenue_pct) || 0;
    partnerCut = Math.round((amountTotal * pct) / 100);
    evCut = amountTotal - partnerCut;
    partnerStripeAccountId = partner?.stripe_account_id || null;
  }

  const willTransfer = !!(partnerId && partnerStripeAccountId && partnerCut > 0);
  const { data: vaultOrder } = await orderRepo.insert(supabase, {
    client_id: clientId,
    partner_id: partnerId,
    product_type: "vault_subscription",
    status: partnerId && partnerCut > 0 ? "paid" : "delivered",
    amount_total: amountTotal,
    partner_cut: partnerCut,
    ev_cut: evCut,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  });

  if (vaultOrder && partnerId && partnerCut > 0 && !willTransfer) {
    await payoutRepo.insertPartnerPayout(supabase, {
      partner_id: partnerId,
      amount: partnerCut,
      status: "pending",
      orders_included: [vaultOrder.id],
    });
  }

  if (vaultOrder && partnerId && partnerStripeAccountId && partnerCut > 0) {
    try {
      const transfer = await transferToPartner(
        partnerStripeAccountId,
        partnerCut,
        vaultOrder.id,
        partnerId,
        "vault_subscription",
      );
      if (transfer) {
        await orderRepo.update(supabase, vaultOrder.id, {
          status: "delivered",
        });
        await payoutRepo.insertPartnerPayout(supabase, {
          partner_id: partnerId,
          amount: partnerCut,
          status: "sent",
          stripe_transfer_id: transfer.id,
          orders_included: [vaultOrder.id],
        });
        await auditLogRepo.insertEntry(supabase, {
          action: "payout.sent",
          resource_type: "payout",
          resource_id: vaultOrder.id,
          metadata: {
            partner_id: partnerId,
            amount: partnerCut,
            transfer_id: transfer.id,
            product_type: "vault_subscription",
          },
        });
      }
    } catch (err) {
      console.error("Vault subscription partner transfer failed:", err);
    }
  }
}
