import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authCheckVerificationSchema } from "@/lib/validation/schemas";
import { pollLink } from "@/lib/auth/emailVerification";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = authCheckVerificationSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { email, sessionId } = parsed.data;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const session = String(sessionId || "").trim();

  if (!normalizedEmail || !session) return ok({ verified: false });

  const token = pollLink(normalizedEmail, session);
  if (!token) return ok({ verified: false });

  return ok({ verified: true, token });
});
