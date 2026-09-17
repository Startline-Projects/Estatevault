import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { adminTestPromoSchema } from "@/lib/validation/schemas";
import * as appSettingsRepo from "@/lib/repos/server/appSettingsRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import { TEST_PROMO_SWITCH_KEY } from "@/lib/orders/promo";

export const GET = withRoute(async (_req: NextRequest) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const { data, error } = await appSettingsRepo.getByKey(auth.admin, TEST_PROMO_SWITCH_KEY);

  if (error) {
    console.error("app_settings read error:", error.message);
    return ok({ active: false });
  }

  const active = (data?.value as { active?: boolean })?.active ?? false;
  return ok({ active });
});

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = adminTestPromoSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { active } = parsed.data;

  const { error: upsertErr } = await appSettingsRepo.upsertByKey(
    auth.admin,
    TEST_PROMO_SWITCH_KEY,
    { active: !!active },
    auth.user.id,
  );
  if (upsertErr) return fail("Failed to update", 500);

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: active ? "test_promo.activated" : "test_promo.deactivated",
    resource_type: "app_settings",
    metadata: { active: !!active },
  });

  return ok({ success: true, active: !!active });
});
