import { stripe } from "@/lib/stripe";
import { getAccountStatus } from "@/lib/stripe-payouts";
import { getPlatformDefaultReviewFee } from "@/lib/attorney-review/fee";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as payoutRepo from "@/lib/repos/server/payoutRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import type { Admin } from "./types";

// Create the attorney-review record for a paid order with review requested,
// route it to the correct reviewer, and transfer the fee to a partner-admin
// reviewer when that's the fee destination.
export async function handleAttorneyReview(
  supabase: Admin,
  orderId: string,
  partnerId: string | undefined,
  productType: "will" | "trust",
) {
  const { resolveReviewRouting, INHOUSE_ATTORNEY_EMAIL, ESTATEVAULT_ADMIN_EMAIL } =
    await import("@/lib/attorney-review/routing");

  const slaDeadline = new Date();
  slaDeadline.setHours(slaDeadline.getHours() + 96);

  let partnerForRouting: import("@/lib/attorney-review/types").PartnerForRouting | null = null;
  if (partnerId) {
    const { data } = await partnerRepo.getReviewRoutingInfo(supabase, partnerId);
    if (data) {
      partnerForRouting = {
        ...data,
        profile_id: data.profile_id ?? "",
        has_inhouse_estate_attorney: data.has_inhouse_estate_attorney ?? false,
      };
    }
  }

  const { data: moProfile } = await profileRepo.findIdByEmailMaybe(supabase, INHOUSE_ATTORNEY_EMAIL);
  const { data: adminProfile } = await profileRepo.findIdByEmailMaybe(supabase, ESTATEVAULT_ADMIN_EMAIL);
  const platformDefaultFee = await getPlatformDefaultReviewFee(supabase);

  const routing = resolveReviewRouting(
    partnerForRouting,
    moProfile?.id || null,
    adminProfile?.id || null,
    platformDefaultFee,
  );

  await attorneyReviewRepo.insert(supabase, {
    order_id: orderId,
    attorney_id: routing.reviewerId,
    status: "pending",
    attorney_fee: routing.feeAmount,
    fee_amount: routing.feeAmount,
    reviewer_type: routing.reviewerType,
    fee_destination: routing.feeDestination,
    fee_controlled_by: routing.feeControlledBy,
    partner_id: routing.partnerId,
    sla_deadline: slaDeadline.toISOString(),
  });

  // The attorney-review fee is owed to a partner only when it routes to a
  // partner-admin reviewer. (Other destinations keep the fee with the platform
  // and need no transfer/payout row.)
  if (routing.feeDestination === "partner_admin" && routing.partnerId) {
    const feePartnerId = routing.partnerId;
    // Hard guard (BUG-4): never transfer more than the client actually paid for
    // the attorney review on this order, even if routing data is stale.
    const { data: orderRow } = await orderRepo.getAttorneyCut(supabase, orderId);
    const collected = orderRow?.attorney_cut ?? 0;
    const transferAmount = Math.min(routing.feeAmount, collected);
    if (transferAmount <= 0) {
      console.error(
        `Attorney review transfer skipped for order ${orderId}: nothing collected (attorney_cut=${collected}).`,
      );
      return;
    }

    // BUG-25: never let the owed fee silently vanish. Whenever we cannot send
    // right now (no Connect account, transfers capability inactive, status
    // check throws, transfer returns null, or it throws), write a `pending`
    // payout IOU so reconciliation can recover it — mirroring the BUG-15 fix
    // for the document partner cut. Guarded so we never double-write.
    let feeRecorded = false;
    const recordPendingFee = async () => {
      if (feeRecorded) return;
      await payoutRepo.insertPartnerPayout(supabase, {
        partner_id: feePartnerId,
        amount: transferAmount,
        status: "pending",
        orders_included: [orderId],
      });
      feeRecorded = true;
      await auditLogRepo.insertEntry(supabase, {
        action: "attorney_review.fee_pending",
        resource_type: "attorney_review",
        resource_id: orderId,
        metadata: { destination: "partner_admin", amount: transferAmount, partner_id: feePartnerId },
      });
    };

    try {
      const acctId = partnerForRouting?.stripe_account_id;
      // A Connect account can only RECEIVE a transfer once `transfers` is active;
      // details_submitted/payouts_enabled can be true while it is still pending.
      let transfersActive = false;
      if (acctId) {
        try {
          transfersActive = (await getAccountStatus(acctId)).transfers_active;
        } catch (statusError) {
          console.error("Connect account status check failed:", statusError);
        }
      }

      if (!acctId || !transfersActive) {
        await recordPendingFee();
      } else {
        const transfer = await stripe.transfers.create(
          {
            amount: transferAmount,
            currency: "usd",
            destination: acctId,
            transfer_group: orderId,
            metadata: {
              type: "attorney_review_fee",
              order_id: orderId,
              reviewer_type: routing.reviewerType,
            },
          },
          // BUG-23: idempotency key so a replay never double-transfers the fee,
          // even if it slips past the attorney_reviews(order_id) insert guard.
          { idempotencyKey: `attyfee_${orderId}` },
        );

        if (transfer) {
          await payoutRepo.insertPartnerPayout(supabase, {
            partner_id: feePartnerId,
            amount: transferAmount,
            status: "sent",
            stripe_transfer_id: transfer.id,
            orders_included: [orderId],
          });
          feeRecorded = true;
          await auditLogRepo.insertEntry(supabase, {
            action: "attorney_review.fee_transferred",
            resource_type: "attorney_review",
            resource_id: orderId,
            metadata: {
              destination: "partner_admin",
              amount: transferAmount,
              transfer_id: transfer.id,
              partner_id: feePartnerId,
            },
          });
        } else {
          await recordPendingFee();
        }
      }
    } catch (transferErr) {
      console.error("Attorney review fee transfer failed:", transferErr);
      // Never drop the owed fee on error — leave a reconcilable IOU (BUG-25).
      try {
        await recordPendingFee();
      } catch (pendingError) {
        console.error("Failed to record pending attorney-review fee:", pendingError);
      }
    }
  }
}
