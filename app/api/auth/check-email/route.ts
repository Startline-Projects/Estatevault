import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authCheckEmailSchema } from "@/lib/validation/schemas";
import { checkEmailIpRateLimit, checkEmailTargetRateLimit } from "@/lib/rate-limit";
import { OWNED_STATUSES } from "@/lib/orders/plan-conflict";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = authCheckEmailSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { email } = parsed.data;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) return fail("Email is required.", 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { success: ipOk } = await checkEmailIpRateLimit.limit(ip);
  if (!ipOk) return fail("Too many requests. Please try again later.", 429);
  const { success: targetOk } = await checkEmailTargetRateLimit.limit(normalizedEmail);
  if (!targetOk) return fail("Too many requests. Please try again later.", 429);

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_type")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!profile) return ok({ exists: false, claimable: false });

  // A "claimable" account exists but has never paid — e.g. a partner-created
  // client shell, or any client profile with no owned (paid) order. The checkout
  // already proves inbox ownership via email verification, and checkPlanConflict
  // still blocks real paid plans, so we let these continue instead of dead-ending
  // at "an account already exists". Non-client accounts (partner/attorney/admin)
  // are never claimable — they must sign in.
  let claimable = false;
  if (profile.user_type === "client") {
    const { data: clients } = await admin.from("clients").select("id").eq("profile_id", profile.id);
    const clientIds = (clients ?? []).map((c) => c.id);
    if (clientIds.length === 0) {
      claimable = true;
    } else {
      const { count } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("client_id", clientIds)
        .in("status", OWNED_STATUSES);
      claimable = (count ?? 0) === 0;
    }
  }

  return ok({ exists: true, claimable });
});
