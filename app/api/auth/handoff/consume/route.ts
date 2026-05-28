import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authHandoffConsumeSchema } from "@/lib/validation/schemas";
import { decryptHandoff } from "@/lib/handoff";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = authHandoffConsumeSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { token } = parsed.data;

  try {
    const payload = decryptHandoff(token);
    return ok({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      redirect_path: payload.redirect_path,
    });
  } catch {
    return fail("Invalid or expired handoff token", 400);
  }
});
