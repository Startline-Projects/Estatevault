import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as referralRepo from "@/lib/repos/server/referralRepo";

// B2: the signed-in partner's attorney referrals (was a direct client-side
// supabase.from("referrals") read in app/pro/referrals).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  if (!partner) return ok({ referrals: [] });

  const { data: referrals } = await referralRepo.listByPartner(auth.admin, partner.id);
  return ok({ referrals: referrals ?? [] });
});
