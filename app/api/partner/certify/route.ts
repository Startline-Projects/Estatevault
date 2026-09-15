import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import { partnerCertifySchema } from "@/lib/validation/schemas";

// Marks a partner's certification complete.
//
// This used to accept the partner themselves, with an empty body: the training
// exam had no questions, so any signed-in partner could certify themselves by
// calling this route. Until a real exam exists, certification is conferred by
// Admin or a sales rep, who is accountable for having actually checked.
export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin", "sales_rep"], req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = partnerCertifySchema.safeParse(body);
  if (!parsed.success) return fail("partnerId is required", 400);

  const { data } = await partnerRepo.update(auth.admin, parsed.data.partnerId, {
    certification_completed: true,
  });
  if (!data) return fail("partner not found", 404);

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.profile.id,
    action: "partner.certification_completed",
    resource_type: "partner",
    resource_id: parsed.data.partnerId,
  });

  return ok({ success: true });
});
