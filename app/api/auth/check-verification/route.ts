import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { pollLink } from "@/lib/auth/emailVerification";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  const { email, sessionId } = await req.json();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const session = String(sessionId || "").trim();

  if (!normalizedEmail || !session) return ok({ verified: false });

  const token = pollLink(normalizedEmail, session);
  if (!token) return ok({ verified: false });

  return ok({ verified: true, token });
});
