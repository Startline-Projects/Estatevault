export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authExchangeResetTokenSchema } from "@/lib/validation/schemas";
import { claimResetToken } from "@/lib/auth/resetTokenStore";

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = authExchangeResetTokenSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);

  const { token_hash } = parsed.data;

  const claimed = await claimResetToken(token_hash);
  if (!claimed) {
    console.warn("[reset-token] Replay detected, token prefix:", token_hash.slice(0, 8));
    return fail("link_already_used", 410);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "recovery",
  });

  if (error) {
    console.warn("[reset-token] verifyOtp failed:", error.message);
    return fail("invalid_or_expired_link", 400);
  }

  return ok({ success: true });
});
