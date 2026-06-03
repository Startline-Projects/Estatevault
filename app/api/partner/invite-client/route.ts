import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { waitlistInviteSchema } from "@/lib/validation/schemas";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as waitlistInviteRepo from "@/lib/repos/server/waitlistInviteRepo";

// B2: a partner queues a pre-launch client invite. Replaces the direct
// `supabase.from("waitlist_invites").insert(...)` the onboarding step ran
// client-side — partner_id is now resolved server-side from the session.
export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const parsed = waitlistInviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("partner not found", 404);

  await waitlistInviteRepo.insert(auth.admin, {
    partner_id: partner.id,
    client_email: parsed.data.client_email,
  });
  return ok({ success: true });
});
