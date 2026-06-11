import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesRepsUpdateSchema } from "@/lib/validation/schemas";
import { DEFAULT_COMMISSION_RATE } from "@/lib/sales/constants";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const GET = withRoute(async (_req: NextRequest) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const { data: reps, error: repsErr } = await profileRepo.findAllSalesReps(auth.admin);
  if (repsErr) return fail("Failed to fetch reps", 500);

  const repsWithCounts = await Promise.all(
    (reps || []).map(async (rep) => {
      const { count } = await partnerRepo.countActiveByCreator(auth.admin, rep.id);
      return {
        id: rep.id,
        full_name: rep.full_name || "Unknown",
        email: rep.email,
        active_partners: count || 0,
        created_at: rep.created_at,
        commission_rate: rep.commission_rate ?? DEFAULT_COMMISSION_RATE,
      };
    })
  );

  return ok({ reps: repsWithCounts });
});

export const PATCH = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = salesRepsUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { repId, commissionRate } = parsed.data;

  await profileRepo.updateCommissionRate(auth.admin, repId, commissionRate / 100);
  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "sales_rep.commission_updated",
    resource_type: "profile",
    resource_id: repId,
    metadata: { commission_rate: commissionRate / 100 },
  });

  return ok({ success: true });
});
