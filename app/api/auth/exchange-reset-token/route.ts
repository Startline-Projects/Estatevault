export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authExchangeResetTokenSchema } from "@/lib/validation/schemas";
import { claimResetToken, isResetTokenClaimed } from "@/lib/auth/resetTokenStore";
import { authIpRateLimit, clientIp } from "@/lib/rate-limit";

// Called by /auth/reset-password for someone who has just clicked the emailed
// link — so, by definition, someone with no session. It is therefore listed in
// lib/supabase/publicPaths.ts and authenticates itself: the token_hash is
// verified against Supabase, which is also what establishes the session the
// page then uses to set the new password.
export const POST = withRoute(async (req: NextRequest) => {
  // Public, so limited by source the way set-password is.
  const { success } = await authIpRateLimit.limit(`reset-exchange:${clientIp(req)}`);
  if (!success) return fail("Too many attempts. Please wait and try again.", 429);

  const body = await req.json();
  const parsed = authExchangeResetTokenSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);

  const { token_hash } = parsed.data;

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "recovery",
  });

  if (error) {
    // Supabase being unreachable or failing says nothing about the link, which
    // is still unspent. Say so, rather than send the person off for a new one.
    const status = (error as { status?: number }).status;
    if (error.name === "AuthRetryableFetchError" || status === 0 || (typeof status === "number" && status >= 500)) {
      console.warn("[reset-token] verifyOtp unavailable:", error.message);
      return fail("Something went wrong. Please reload this page to try again.", 503);
    }

    // Supabase refuses a second use on its own. Our record only decides which
    // message the person sees: "already used" or "invalid or expired". If the
    // record cannot be read, say the less specific thing rather than fail.
    const alreadyUsed = await isResetTokenClaimed(token_hash).catch(() => false);
    if (alreadyUsed) {
      console.warn("[reset-token] Replay detected, token prefix:", token_hash.slice(0, 8));
      return fail("link_already_used", 410);
    }
    console.warn("[reset-token] verifyOtp failed:", error.message);
    return fail("invalid_or_expired_link", 400);
  }

  // Mark the link used only now that it has actually worked. This used to
  // happen before verifyOtp, so a transient Supabase failure burned a valid
  // link and told the person it had "already been used" on their next try.
  //
  // Best-effort, and it has to be: by this point Supabase has consumed the
  // one-time token and the session cookies are set. Letting a store outage
  // throw here would answer 500 for a reset that SUCCEEDED, and the page would
  // tell the person their (now spent) link was invalid — the same failure this
  // ordering exists to remove, moved to a different dependency.
  try {
    await claimResetToken(token_hash);
  } catch (e) {
    console.warn("[reset-token] could not record the claim:", e instanceof Error ? e.message : e);
  }

  return ok({ success: true });
});
