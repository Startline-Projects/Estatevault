import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { apiRateLimit, clientIp } from "@/lib/rate-limit";
import * as appSettingsRepo from "@/lib/repos/server/appSettingsRepo";
import {
  isTrustedPromoOrigin,
  promoDecision,
  promoKind,
  TEST_PROMO_SWITCH_KEY,
} from "@/lib/orders/promo";

// Answers "will checkout honour this code?" for the promo field on the
// checkout pages. This route used to keep its own hardcoded list (FREE134,
// TEST) while the charger read PROMO_CODES, so the two disagreed in both
// directions: a configured code showed as invalid, and a retired one as valid.
// Both now go through promoDecision over the same env-configured set.
export const POST = withRoute(async (req: NextRequest) => {
  // Public and cheap, which makes it a guessing oracle over PROMO_CODES.
  // Same budget check-conflict applies to its own public probe.
  const { success } = await apiRateLimit.limit(`promo:${clientIp(req)}`);
  if (!success) return fail("Too many requests", 429);

  const body = await req.json();
  const code = String(body?.code || "").trim();
  if (!code) return fail("Code is required", 400);

  // The admin switch only matters for a test code from a trusted origin, and
  // promoDecision refuses an untrusted origin before it looks at the switch —
  // so, like the charger, leave the database alone in every other case.
  const trustedOrigin = isTrustedPromoOrigin(req);
  let testSwitchOn = false;
  if (trustedOrigin && promoKind(code) === "test") {
    const { data } = await appSettingsRepo.getByKey(createAdminClient(), TEST_PROMO_SWITCH_KEY);
    testSwitchOn = (data?.value as { active?: boolean } | null)?.active ?? false;
  }

  const decision = promoDecision(code, { testSwitchOn, trustedOrigin });

  // `kind` lets the page pick the right flow (a test order skips the email
  // step) without hardcoding the code's spelling.
  return ok({ valid: decision.accepted, kind: decision.accepted ? decision.kind : null });
});
