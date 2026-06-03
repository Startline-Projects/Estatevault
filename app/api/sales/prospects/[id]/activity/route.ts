import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesProspectActivitySchema } from "@/lib/validation/schemas";
import * as salesProspectRepo from "@/lib/repos/server/salesProspectRepo";

// B2: a prospect's activity log.
export const GET = withRoute(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  // Scope: only return activity for a prospect this rep owns.
  const { data: owned } = await salesProspectRepo.getOwnedById(auth.admin, params.id, auth.user.id);
  if (!owned) return ok({ activity: [] });

  const { data: activity } = await salesProspectRepo.listActivity(auth.admin, params.id);
  return ok({ activity: activity ?? [] });
});

// B2: log an activity entry on a prospect.
export const POST = withRoute(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const parsed = salesProspectActivitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  const { data: owned } = await salesProspectRepo.getOwnedById(auth.admin, params.id, auth.user.id);
  if (!owned) return fail("not found", 404);

  await salesProspectRepo.insertActivity(auth.admin, {
    prospect_id: params.id,
    sales_rep_id: auth.user.id,
    type: parsed.data.type,
    body: parsed.data.body ?? null,
  });
  return ok({ success: true });
});
