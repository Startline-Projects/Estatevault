import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authVerifyCodeSchema } from "@/lib/validation/schemas";
import { verifyCode } from "@/lib/auth/emailVerification";
import { emailVerifyRateLimit, emailVerifyIpRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = authVerifyCodeSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { email, code } = parsed.data;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCode = String(code || "").trim();

  if (!normalizedEmail || !normalizedCode) return fail("Email and code are required.", 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { success: ipOk } = await emailVerifyIpRateLimit.limit(ip);
  if (!ipOk) return fail("Too many attempts. Please try again later.", 429);
  const { success: emailOk } = await emailVerifyRateLimit.limit(normalizedEmail);
  if (!emailOk) return fail("Too many attempts. Please try again later.", 429);

  const result = await verifyCode(normalizedEmail, normalizedCode);

  if (!result.ok) {
    const reasonMap: Record<typeof result.reason, string> = {
      expired: "Code expired. Request a new one.",
      invalid: "Incorrect code. Try again.",
      too_many: "Too many attempts. Request a new code.",
      not_requested: "No code requested. Click Send Code first.",
    };
    return fail(reasonMap[result.reason], 400);
  }

  return ok({ success: true, token: result.token });
});
