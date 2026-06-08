import { stripe } from "@/lib/stripe";
import { getPlatformDefaultReviewFee } from "@/lib/attorney-review/fee";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
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

  if (routing.feeDestination === "partner_admin" && partnerForRouting?.stripe_account_id) {
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
    try {
      const transfer = await stripe.transfers.create({
        amount: transferAmount,
        currency: "usd",
        destination: partnerForRouting.stripe_account_id,
        transfer_group: orderId,
        metadata: {
          type: "attorney_review_fee",
          order_id: orderId,
          reviewer_type: routing.reviewerType,
        },
      });
      await auditLogRepo.insertEntry(supabase, {
        action: "attorney_review.fee_transferred",
        resource_type: "attorney_review",
        resource_id: orderId,
        metadata: {
          destination: "partner_admin",
          amount: transferAmount,
          transfer_id: transfer.id,
          partner_id: routing.partnerId,
        },
      });
    } catch (transferErr) {
      console.error("Attorney review fee transfer failed:", transferErr);
    }
  }
}
