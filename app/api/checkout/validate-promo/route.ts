import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as appSettingsRepo from "@/lib/repos/server/appSettingsRepo";

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const code = String(body?.code || "").trim().toUpperCase();

  if (!code) return fail("Code is required", 400);

  if (code === "TEST") {
    const admin = createAdminClient();
    const { data } = await appSettingsRepo.getByKey(admin, "test_promo_code");
    const active = (data?.value as { active?: boolean })?.active ?? false;
    return ok({ valid: active });
  }

  if (code === "FREE134") {
    return ok({ valid: true });
  }

  return ok({ valid: false });
});
