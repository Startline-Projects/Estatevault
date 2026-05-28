export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesAffiliateStatusSchema } from "@/lib/validation/schemas";
import * as affiliateRepo from "@/lib/repos/server/affiliateRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const POST = withRoute(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = salesAffiliateStatusSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { status } = parsed.data;

  const { data: affiliate } = await affiliateRepo.getWithStatus(auth.admin, params.id);
  if (!affiliate) return fail("Affiliate not found", 404);

  await affiliateRepo.updateStatus(auth.admin, params.id, status);

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "affiliate.status_changed",
    resource_type: "affiliate",
    resource_id: params.id,
    metadata: { from: affiliate.status, to: status },
  });

  return ok({ success: true, status });
});
