export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { transferToAffiliateBatch } from "@/lib/stripe-payouts";
import * as affiliateRepo from "@/lib/repos/server/affiliateRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

const COVERING_PAYOUT_STATUSES = ["pending", "processing", "sent"];

export const POST = withRoute(async (
  _req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const affiliateId = params.id;
  const { data: affiliate } = await affiliateRepo.getPayoutInfoById(auth.admin, affiliateId);
  if (!affiliate) return fail("Affiliate not found", 404);
  if (!affiliate.stripe_account_id || !affiliate.stripe_onboarding_complete) {
    return fail("Affiliate has not completed Stripe onboarding", 400);
  }

  const { data: orders } = await affiliateRepo.getAttributedOrders(auth.admin, affiliateId);
  const earned = (orders ?? []).reduce((s, o) => s + (o.affiliate_cut || 0), 0);

  const { data: priorPayouts } = await affiliateRepo.getPriorPayouts(auth.admin, affiliateId);
  const covered = (priorPayouts ?? [])
    .filter((p) => p.status != null && COVERING_PAYOUT_STATUSES.includes(p.status))
    .reduce((s, p) => s + (p.amount_cents || 0), 0);

  const unpaid = earned - covered;
  if (unpaid <= 0) return fail("No unpaid balance to pay out", 400);

  const orderIds = (orders ?? []).map((o) => o.id);

  const transfer = await transferToAffiliateBatch(
    affiliate.stripe_account_id,
    unpaid,
    affiliateId,
    orderIds
  );
  if (!transfer) return fail("Stripe transfer failed", 500);

  await affiliateRepo.insertPayout(auth.admin, {
    affiliate_id: affiliateId,
    amount_cents: unpaid,
    status: "sent",
    stripe_transfer_id: transfer.id,
    orders_included: orderIds,
    paid_at: new Date().toISOString(),
  });

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "affiliate.payout_sent",
    resource_type: "affiliate",
    resource_id: affiliateId,
    metadata: { amount_cents: unpaid, stripe_transfer_id: transfer.id, order_count: orderIds.length },
  });

  return ok({ success: true, amount_cents: unpaid, transfer_id: transfer.id });
});
