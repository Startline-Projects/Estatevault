import { type NextRequest } from "next/server";
import { getAppUrl } from "@/lib/config/appUrl";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import { issueTrusteeToken, hashToken } from "@/lib/security/trusteeToken";
import { sendTrusteeUnlockEmail } from "@/lib/email";
import * as farewellVerificationRepo from "@/lib/repos/server/farewellVerificationRepo";

export const runtime = "nodejs";

const ACCESS_TTL_SECONDS = 7 * 24 * 3600;

export const GET = withRoute(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return fail("unauthorized", 401);
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: ready, error } = await farewellVerificationRepo.findExpiredUnnotified(
    admin,
    now.toISOString(),
  );
  if (error) {
    console.error("[window-expired] query failed:", error);
    return fail("query failed", 500);
  }

  let issued = 0;
  for (const r of ready || []) {
    const token = issueTrusteeToken(r.id, r.trustee_email, ACCESS_TTL_SECONDS);
    const expiresAt = new Date(now.getTime() + ACCESS_TTL_SECONDS * 1000);

    const { error: upErr } = await farewellVerificationRepo.stampTrusteeNotified(admin, r.id, {
      trustee_access_token_hash: hashToken(token),
      access_expires_at: expiresAt.toISOString(),
      trustee_email_notified_at: now.toISOString(),
    });
    if (upErr) {
      console.error("[window-expired] update failed:", upErr);
      continue;
    }

    const baseUrl = getAppUrl();
    const unlockUrl = `${baseUrl}/trustee/unlock?token=${token}`;

    try {
      await sendTrusteeUnlockEmail({ to: r.trustee_email, unlockUrl, expiresAt });
      await farewellVerificationRepo.insertTrusteeAudit(admin, {
        trustee_id: r.trustee_id ?? "",
        client_id: r.client_id,
        request_id: r.id,
        action: "unlock_link_emailed",
        metadata: { trustee_email: r.trustee_email },
      });
      issued++;
    } catch (e) {
      console.error("[window-expired] email send failed:", e);
    }
  }

  return ok({ ok: true, checked: ready?.length || 0, issued });
});
