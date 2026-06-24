import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { hardStopReferralSchema } from "@/lib/validation/schemas";
import { REFERRAL_FEE_CENTS } from "@/lib/orders/pricing";
import * as referralRepo from "@/lib/repos/server/referralRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";

// PUBLIC: log an attorney referral when a client hits a hard stop during intake
// (Core Rule 4 — special-needs dependent). This is the primary referral-creation
// point: the intake stops the client before checkout, so the checkout-session
// hard-stop guard never runs for this flow. Always returns ok so the client-side
// hard-stop screen is never blocked. Spam-guarded: the partner must exist and be
// active, and rapid repeats are collapsed.
export const POST = withRoute(async (req: NextRequest) => {
  const parsed = hardStopReferralSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return ok({ recorded: false });
  const { partnerId, reason, name, email, phone } = parsed.data;

  const admin = createAdminClient();

  // A claimed partner must be real + active (anti-spoof — never write a fee-
  // bearing row against a bogus UUID). Direct leads from EstateVault's own site
  // carry no partner and are recorded with no fee.
  if (partnerId) {
    const { data: partner } = await partnerRepo.getById(admin, partnerId);
    if (!partner || partner.status !== "active") return ok({ recorded: false });
  }

  // Link to an existing client account when this email already has one.
  let clientId: string | null = null;
  const { data: prof } = await profileRepo.findIdByEmailMaybe(admin, email);
  if (prof?.id) {
    const { data: cli } = await clientRepo
      .getIdByProfile(admin, prof.id)
      .then((r) => r, () => ({ data: null }));
    clientId = cli?.id ?? null;
  }

  // Dedupe by (email, partner) so a double-submit / refresh doesn't stack rows.
  const { data: existing } = await referralRepo.findOpenByEmailAndPartner(
    admin,
    email,
    partnerId ?? null,
  );
  if (existing) return ok({ recorded: false });

  await referralRepo.insert(admin, {
    partner_id: partnerId ?? null,
    client_id: clientId,
    client_name: name,
    client_email: email,
    client_phone: phone ?? null,
    reason,
    status: "pending",
    // Only a partner-attributed lead earns the fee; a direct lead owes nothing.
    referral_fee: partnerId ? REFERRAL_FEE_CENTS : 0,
    referral_fee_paid: false,
  });

  return ok({ recorded: true });
});
