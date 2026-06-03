import Stripe from "stripe";
import { transferToPartner } from "@/lib/stripe-payouts";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as payoutRepo from "@/lib/repos/server/payoutRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import type { Admin } from "./types";

// Paid amendments mark the order paid/generating and pay any partner cut, but
// never create a will/trust document set or queue a will generation job.
export async function handleAmendmentCheckout(
  supabase: Admin,
  session: Stripe.Checkout.Session,
  orderId: string,
) {
  await orderRepo.update(supabase, orderId, {
    status: "generating",
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  });

  // Partner payout (amendment splits exist in PARTNER_SPLITS). The order row's
  // partner_cut was computed at checkout; transfer it if the partner is connected.
  const { data: order } = await supabase
    .from("orders")
    .select("partner_id, partner_cut")
    .eq("id", orderId)
    .single();

  const partnerId = order?.partner_id ?? null;
  const partnerCut = order?.partner_cut ?? 0;

  if (partnerId && partnerCut > 0) {
    try {
      const { data: partner } = await partnerRepo.getStripeAndTier(supabase, partnerId);
      if (partner?.stripe_account_id) {
        const transfer = await transferToPartner(
          partner.stripe_account_id,
          partnerCut,
          orderId,
          partnerId,
          "amendment",
        );
        if (transfer) {
          await payoutRepo.insertPartnerPayout(supabase, {
            partner_id: partnerId,
            amount: partnerCut,
            status: "sent",
            stripe_transfer_id: transfer.id,
            orders_included: [orderId],
          });
        }
      } else {
        await payoutRepo.insertPartnerPayout(supabase, {
          partner_id: partnerId,
          amount: partnerCut,
          status: "pending",
          orders_included: [orderId],
        });
      }
    } catch (payoutError) {
      console.error("Amendment partner payout failed:", payoutError);
    }
  }

  await auditLogRepo.insertEntry(supabase, {
    action: "order.paid",
    resource_type: "order",
    resource_id: orderId,
    metadata: { product_type: "amendment", amount: session.amount_total },
  });
}
