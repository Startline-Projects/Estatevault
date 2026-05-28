import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
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
        commission_rate: rep.commission_rate ?? 0.05,
      };
    })
  );

  return ok({ reps: repsWithCounts });
});

export const PATCH = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const { repId, commissionRate } = await req.json();
  if (!repId || commissionRate === undefined) return fail("Missing repId or commissionRate", 400);

  const parsed = parseFloat(commissionRate);
  if (isNaN(parsed) || parsed < 0 || parsed > 100) {
    return fail("Commission rate must be between 0 and 100", 400);
  }

  await profileRepo.updateCommissionRate(auth.admin, repId, parsed / 100);
  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "sales_rep.commission_updated",
    resource_type: "profile",
    resource_id: repId,
    metadata: { commission_rate: parsed / 100 },
  });

  return ok({ success: true });
});
