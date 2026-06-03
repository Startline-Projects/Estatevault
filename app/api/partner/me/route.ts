import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { partnerSelfUpdateSchema } from "@/lib/validation/schemas";
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

// B2: partner self-update of NON-financial onboarding fields (scoped to their
// own row by profile_id). Payment flags stay server/webhook-controlled.
export const PATCH = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const parsed = partnerSelfUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  const { data } = await partnerRepo.updateByProfileId(auth.admin, auth.profile.id, parsed.data);
  if (!data) return fail("partner not found", 404);
  return ok({ success: true });
});
