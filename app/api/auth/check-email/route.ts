import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authCheckEmailSchema } from "@/lib/validation/schemas";
import { checkEmailIpRateLimit, checkEmailTargetRateLimit } from "@/lib/rate-limit";

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
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  return ok({ exists: !!profile });
});
