import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { adminReferralConvertSchema } from "@/lib/validation/schemas";
import { getAccountStatus, transferReferralFee } from "@/lib/stripe-payouts";
import * as referralRepo from "@/lib/repos/server/referralRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

// Admin-only: list all attorney referrals and mark one converted. Converting a
// PARTNER-attributed referral transfers the $75 fee to the partner's Stripe
// Connect account (real money), then flips status -> "converted" and
// referral_fee_paid. A direct (no-partner / $0) lead is just marked converted.

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"], req);
  if ("error" in auth) return auth.error;

  const { data: referrals, error } = await referralRepo.listAllForAdmin(auth.admin);
  if (error) return fail("Failed to fetch referrals", 500);
  const rows = referrals ?? [];

  // Resolve whether each partner can actually RECEIVE the transfer (transfers
  // capability active), so the convert button is only enabled when a real
  // payout will succeed. Checked once per UNIQUE Stripe account (deduped) to
  // keep this to a handful of calls; any failure defaults to not-payable.
  const accountIds = Array.from(
    new Set(rows.map((r) => r.partners?.stripe_account_id).filter((id): id is string => !!id)),
  );
  const statuses = await Promise.all(
    accountIds.map(async (id) => {
      try {
        return [id, (await getAccountStatus(id)).transfers_active] as const;
      } catch {
        return [id, false] as const;
      }
    }),
  );
  const payableByAccount = new Map(statuses);

  const withPayable = rows.map((r) => ({
    ...r,
    partner_payable: r.partners?.stripe_account_id
      ? payableByAccount.get(r.partners.stripe_account_id) ?? false
      : false,
  }));

  return ok({ referrals: withPayable });
});

export const PATCH = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"], req);
  if ("error" in auth) return auth.error;

  const parsed = adminReferralConvertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);
  const { referralId } = parsed.data;

  const { data: ref } = await referralRepo.getById(auth.admin, referralId);
  if (!ref) return fail("Referral not found", 404);
  // Idempotent: a second click after a successful payout is a no-op.
  if (ref.referral_fee_paid) return ok({ success: true, alreadyPaid: true });

  const fee = ref.referral_fee ?? 0;
  let transferId: string | null = null;

  // Partner-attributed fee → move real money. No partner, or $0, → just mark.
  if (ref.partner_id && fee > 0) {
    const { data: partner } = await partnerRepo.getStripeAndTier(auth.admin, ref.partner_id);
    if (!partner?.stripe_account_id) {
      return fail("Partner has not connected a Stripe account.", 400);
    }

    // Authoritative check — the account must be able to RECEIVE transfers.
    let transfersActive = false;
    try {
      transfersActive = (await getAccountStatus(partner.stripe_account_id)).transfers_active;
    } catch {
      return fail("Could not verify the partner's Stripe account.", 502);
    }
    if (!transfersActive) {
      return fail("Partner's Stripe account is not ready to receive transfers.", 400);
    }

    try {
      const transfer = await transferReferralFee(
        partner.stripe_account_id,
        fee,
        referralId,
        ref.partner_id,
      );
      if (!transfer) return fail("Transfer was not created.", 502);
      transferId = transfer.id;
    } catch (err) {
      console.error("Referral fee transfer failed:", err);
      return fail("Stripe transfer failed. The fee was not paid.", 502);
    }
  }

  // Only mark paid AFTER the money has moved (or there was nothing to send).
  const { data: updated, error } = await referralRepo.markConverted(auth.admin, referralId);
  if (error || !updated) return fail("Paid, but failed to update the referral.", 500);

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "referral.converted",
    resource_type: "referral",
    resource_id: updated.id,
    metadata: {
      partner_id: updated.partner_id,
      referral_fee: updated.referral_fee,
      stripe_transfer_id: transferId,
    },
  });

  return ok({ success: true });
});
