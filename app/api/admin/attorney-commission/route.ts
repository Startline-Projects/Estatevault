import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { adminAttorneyCommissionUpdateSchema } from "@/lib/validation/schemas";
import { DEFAULT_COMMISSION_RATE } from "@/lib/sales/constants";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

// Admin-only: read/write the commission rate review attorneys earn on the
// platform fees of partners they recruit. Mirrors the sales-rep rate path
// (/api/sales/reps) but scoped to user_type = "review_attorney".

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"], req);
  if ("error" in auth) return auth.error;

  const { data: attorneys, error } = await profileRepo.findAllReviewAttorneys(auth.admin);
  if (error) return fail("Failed to fetch attorneys", 500);

  return ok({
    attorneys: (attorneys || []).map((a) => ({
      id: a.id,
      full_name: a.full_name || "Unknown",
      email: a.email,
      commission_rate: a.commission_rate ?? DEFAULT_COMMISSION_RATE,
    })),
  });
});

export const PATCH = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"], req);
  if ("error" in auth) return auth.error;

  const parsed = adminAttorneyCommissionUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);
  const { attorneyId, commissionRate } = parsed.data;

  // Stored as a decimal fraction (e.g. 5% -> 0.05), matching profiles.commission_rate.
  const { error } = await profileRepo.updateAttorneyCommissionRate(
    auth.admin,
    attorneyId,
    commissionRate / 100,
  );
  if (error) return fail("Failed to update", 500);

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "attorney.commission_updated",
    resource_type: "profile",
    resource_id: attorneyId,
    metadata: { commission_rate: commissionRate / 100 },
  });

  return ok({ success: true });
});
