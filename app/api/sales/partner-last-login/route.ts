import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin"]);
  if ("error" in auth) return auth.error;

  const partnerId = new URL(req.url).searchParams.get("partnerId");
  if (!partnerId) return fail("Missing partnerId", 400);

  const { data: partner } = await partnerRepo.getProfileId(auth.admin, partnerId);
  if (!partner?.profile_id) return ok({ last_login: null });

  const { data: { user: authUser } } = await auth.admin.auth.admin.getUserById(partner.profile_id);

  return ok({ last_login: authUser?.last_sign_in_at ?? null });
});
