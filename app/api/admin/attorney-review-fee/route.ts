import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { adminReviewFeeDefaultSchema } from "@/lib/validation/schemas";
import { ATTORNEY_REVIEW_FEE_SETTING_KEY } from "@/lib/orders/pricing";
import { getPlatformDefaultReviewFee } from "@/lib/attorney-review/fee";
import * as appSettingsRepo from "@/lib/repos/server/appSettingsRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

// Admin-only: read/write the platform-default attorney review fee (cents).
// This is the fee charged for EstateVault-destined reviews (direct clients and
// non-attorney/no-in-house-attorney partners). Partners cannot change it (BUG-4).

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"], req);
  if ("error" in auth) return auth.error;
  const fee = await getPlatformDefaultReviewFee(auth.admin);
  return ok({ fee });
});

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"], req);
  if ("error" in auth) return auth.error;

  const parsed = adminReviewFeeDefaultSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  const { error: upsertErr } = await appSettingsRepo.upsertByKey(
    auth.admin,
    ATTORNEY_REVIEW_FEE_SETTING_KEY,
    parsed.data.fee,
    auth.user.id,
  );
  if (upsertErr) return fail("Failed to update", 500);

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "admin.attorney_review_fee_default_set",
    resource_type: "app_settings",
    resource_id: ATTORNEY_REVIEW_FEE_SETTING_KEY,
    metadata: { fee: parsed.data.fee },
  });

  return ok({ success: true, fee: parsed.data.fee });
});
