import { requireTrusteeSession, SESSION_COOKIE } from "@/lib/security/trusteeSession";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as fvRepo from "@/lib/repos/server/farewellVerificationRepo";

export const runtime = "nodejs";

export const POST = withRoute(async () => {
  const sess = requireTrusteeSession();
  if (sess) {
    const admin = createAdminClient();
    await fvRepo.insertTrusteeAudit(admin, {
      trustee_id: sess.trusteeId,
      client_id: sess.clientId,
      request_id: sess.requestId,
      action: "logout",
    });
  }
  const res = ok({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
