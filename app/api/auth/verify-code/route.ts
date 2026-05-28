import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { verifyCode } from "@/lib/auth/emailVerification";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  const { email, code } = await req.json();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCode = String(code || "").trim();

  if (!normalizedEmail || !normalizedCode) return fail("Email and code are required.", 400);

  const result = verifyCode(normalizedEmail, normalizedCode);

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
