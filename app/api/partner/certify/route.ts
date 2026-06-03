import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

// B2: marks the signed-in partner's certification complete (after the training
// exam). Replaces the direct client-side `supabase.from("partners").update`.
// Kept as a named action rather than a generic self-update field so the
// financial/onboarding whitelist isn't widened.
export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data } = await partnerRepo.updateByProfileId(auth.admin, auth.profile.id, {
    certification_completed: true,
  });
  if (!data) return fail("partner not found", 404);
  return ok({ success: true });
});
