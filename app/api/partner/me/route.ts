import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

// B2: the signed-in partner's own row, behind the API boundary. Replaces the
// direct `supabase.from("partners").eq("profile_id", user.id)` reads that the
// pro/* screens used to run client-side.
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  return ok({ partner: partner ?? null });
});
