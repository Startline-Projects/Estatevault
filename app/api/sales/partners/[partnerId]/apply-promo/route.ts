import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesApplyPromoSchema } from "@/lib/validation/schemas";
import { PROMO_CODES } from "@/lib/orders/pricing";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

type Ctx = { params: Promise<{ partnerId: string }> };

// B2: a sales rep applies a promo code to one of their managed partners, comping
// the platform fee. SECURITY: ownership enforced (rep must own the partner unless
// admin/review_attorney) and the code is re-validated against PROMO_CODES here —
// the financial flag (one_time_fee_paid) can no longer be flipped client-side.
export const POST = withRoute(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const { partnerId } = await ctx.params;
  const parsed = salesApplyPromoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  const code = parsed.data.promo_code.trim().toUpperCase();
  if (!(code in PROMO_CODES)) return fail("invalid promo code", 400);

  const isAdmin = auth.profile.user_type === "admin" || auth.profile.user_type === "review_attorney";
  const { data: partner } = await partnerRepo.getById(auth.admin, partnerId);
  if (!partner) return fail("partner not found", 404);
  if (!isAdmin && partner.created_by !== auth.user.id) return fail("partner not found", 404);

  await partnerRepo.update(auth.admin, partnerId, {
    promo_code: code,
    one_time_fee_paid: true,
    onboarding_step: Math.max(partner.onboarding_step || 1, 2),
  });
  return ok({ success: true });
});
