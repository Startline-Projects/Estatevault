import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { PROMO_CODES } from "@/lib/orders/pricing";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

// B2: applies a partner's stored promo code, comping the one-time platform fee.
// SECURITY: the comp (one_time_fee_paid) is granted here, server-side, only
// after re-validating the code against PROMO_CODES — the screen can no longer
// flip the financial flag itself. No-op if the partner already paid or has no
// valid code. Returns { applied } so the screen knows whether to skip payment.
export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  if (!partner) return ok({ applied: false });

  if (partner.one_time_fee_paid || partner.annual_fee_paid) {
    return ok({ applied: true });
  }

  const code = (partner.promo_code ?? "").toUpperCase();
  const valid = code in PROMO_CODES;
  if (!valid) return ok({ applied: false });

  await partnerRepo.update(auth.admin, partner.id, {
    one_time_fee_paid: true,
    onboarding_step: 2,
  });
  return ok({ applied: true });
});
