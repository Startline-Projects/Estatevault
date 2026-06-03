import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesProspectUpdateSchema } from "@/lib/validation/schemas";
import * as salesProspectRepo from "@/lib/repos/server/salesProspectRepo";

// B2: update a prospect (stage move or edit), scoped to the owning rep.
export const PATCH = withRoute(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const parsed = salesProspectUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  const { data } = await salesProspectRepo.updateForRep(auth.admin, params.id, auth.user.id, parsed.data);
  if (!data) return fail("not found", 404);
  return ok({ success: true });
});

// B2: delete a prospect, scoped to the owning rep.
export const DELETE = withRoute(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const { data } = await salesProspectRepo.deleteForRep(auth.admin, params.id, auth.user.id);
  if (!data) return fail("not found", 404);
  return ok({ success: true });
});
