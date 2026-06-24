import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { attorneyReferralUpdateSchema } from "@/lib/validation/schemas";
import * as referralRepo from "@/lib/repos/server/referralRepo";

// Review-attorney lead queue. GET lists every hard-stop referral (client contact
// + reason) so the attorney can follow up; PATCH records the attorney's OUTCOME
// (converted / not_converted) — a signal only. The real $75 partner payout stays
// admin-only: the admin sees a "converted" lead and presses pay (Stripe).

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["review_attorney"], req);
  if ("error" in auth) return auth.error;

  const { data: referrals, error } = await referralRepo.listAllForAttorney(auth.admin);
  if (error) return fail("Failed to fetch referrals", 500);

  return ok({ referrals: referrals ?? [] });
});

export const PATCH = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["review_attorney"], req);
  if ("error" in auth) return auth.error;

  const parsed = attorneyReferralUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);
  const { referralId, outcome } = parsed.data;

  // Lock only after the admin has actually paid the partner — at that point the
  // lead is settled and the attorney can't flip the outcome out from under a
  // completed payout. Before payout the attorney may change their mind freely.
  const { data: ref } = await referralRepo.getById(auth.admin, referralId);
  if (!ref) return fail("Referral not found", 404);
  if (ref.referral_fee_paid) return fail("This referral is already paid out.", 409);

  const { data: updated, error } = await referralRepo.setAttorneyOutcome(auth.admin, referralId, outcome);
  if (error || !updated) return fail("Failed to update the referral.", 500);

  return ok({ success: true });
});
