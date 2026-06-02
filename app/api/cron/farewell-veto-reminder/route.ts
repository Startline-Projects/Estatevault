import { type NextRequest } from "next/server";
import { getAppUrl } from "@/lib/config/appUrl";
import { createHash } from "crypto";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import { issueVetoToken } from "@/lib/security/vetoToken";
import { sendVetoReminderEmail } from "@/lib/email";
import * as farewellVerificationRepo from "@/lib/repos/server/farewellVerificationRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";

export const runtime = "nodejs";

export const GET = withRoute(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return fail("unauthorized", 401);
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: active } = await farewellVerificationRepo.findActiveVetoWindows(
    admin,
    now.toISOString(),
  );

  let sent = 0;
  for (const r of active || []) {
    if (!r.unlock_window_expires_at) continue;
    const expiresAt = new Date(r.unlock_window_expires_at);
    const ttlSec = Math.max(60, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    const token = issueVetoToken(r.id, ttlSec);

    await farewellVerificationRepo.updateVetoTokenHash(
      admin,
      r.id,
      createHash("sha256").update(token).digest("hex"),
    );

    const { data: client } = await clientRepo.getReminderStateById(admin, r.client_id);
    if (!client?.profile_id) continue;

    const { data: profile } = await profileRepo.getEmailAndNameById(admin, client.profile_id);
    if (!profile?.email) continue;

    const baseUrl = getAppUrl();
    const vetoUrl = `${baseUrl}/farewell/owner-veto?token=${token}`;

    try {
      await sendVetoReminderEmail({
        to: profile.email,
        vetoUrl,
        expiresAt,
        clientName: profile.full_name,
      });
      sent++;
    } catch (e) {
      console.error("[veto-reminder] send failed:", e);
    }
  }

  return ok({ ok: true, checked: active?.length || 0, sent });
});
