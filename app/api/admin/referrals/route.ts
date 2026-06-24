import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { adminReferralConvertSchema } from "@/lib/validation/schemas";
import * as referralRepo from "@/lib/repos/server/referralRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

// Admin-only: list all attorney referrals and mark one converted. Converting a
// referral flips status -> "converted" and credits the partner's $75 fee
// (referral_fee_paid = true), which the partner dashboard / referrals page sum.

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"], req);
  if ("error" in auth) return auth.error;

  const { data: referrals, error } = await referralRepo.listAllForAdmin(auth.admin);
  if (error) return fail("Failed to fetch referrals", 500);

  return ok({ referrals: referrals ?? [] });
});

export const PATCH = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"], req);
  if ("error" in auth) return auth.error;

  const parsed = adminReferralConvertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  const { data: updated, error } = await referralRepo.markConverted(auth.admin, parsed.data.referralId);
  if (error || !updated) return fail("Failed to convert referral", 500);

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "referral.converted",
    resource_type: "referral",
    resource_id: updated.id,
    metadata: { partner_id: updated.partner_id, referral_fee: updated.referral_fee },
  });

  return ok({ success: true });
});
