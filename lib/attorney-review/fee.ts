// Resolve the admin-controlled platform-default attorney review fee (cents).
//
// The fee is owned by Admin, not partners (BUG-4 fix). The platform default
// lives in `app_settings` under ATTORNEY_REVIEW_FEE_SETTING_KEY; per-partner
// overrides live on `partners.custom_review_fee` and are only writable by Admin.
// Both feed `resolveReviewRouting`, which clamps to ATTORNEY_REVIEW_FEE_RANGE.

import { createAdminClient } from "@/lib/api/auth";
import * as appSettingsRepo from "@/lib/repos/server/appSettingsRepo";
import {
  DEFAULT_ATTORNEY_REVIEW_FEE,
  ATTORNEY_REVIEW_FEE_SETTING_KEY,
  clampAttorneyReviewFee,
} from "@/lib/orders/pricing";

type Admin = ReturnType<typeof createAdminClient>;

export async function getPlatformDefaultReviewFee(admin: Admin): Promise<number> {
  const { data } = await appSettingsRepo.getByKey(admin, ATTORNEY_REVIEW_FEE_SETTING_KEY);
  const raw =
    typeof data?.value === "number"
      ? data.value
      : typeof data?.value === "string"
        ? Number(data.value)
        : NaN;
  if (Number.isFinite(raw) && raw > 0) return clampAttorneyReviewFee(raw);
  return DEFAULT_ATTORNEY_REVIEW_FEE;
}
