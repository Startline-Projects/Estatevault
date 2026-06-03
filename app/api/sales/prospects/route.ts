import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesProspectCreateSchema } from "@/lib/validation/schemas";
import * as salesProspectRepo from "@/lib/repos/server/salesProspectRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

// B2: the rep's pipeline — prospects + their partner cards.
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const [{ data: prospects }, { data: partners }] = await Promise.all([
    salesProspectRepo.listByRep(auth.admin, auth.user.id),
    partnerRepo.listManagedPipeline(auth.admin, auth.user.id),
  ]);
  return ok({ prospects: prospects ?? [], partners: partners ?? [] });
});

// B2: add a prospect (was a direct client-side insert).
export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const parsed = salesProspectCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  const { data, error } = await salesProspectRepo.insert(auth.admin, {
    ...parsed.data,
    sales_rep_id: auth.user.id,
    stage: "prospect",
  });
  if (error || !data) return fail("could not create prospect", 500);
  return ok({ id: data.id });
});
