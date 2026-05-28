import { type NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import { sendAnnualReviewEmail } from "@/lib/email";
import { wantsNotification } from "@/lib/notifications/prefs";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const runtime = "nodejs";

const DAY = 24 * 60 * 60 * 1000;

export const GET = withRoute(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return fail("unauthorized", 401);
  }

  const admin = createAdminClient();
  const now = Date.now();
  const cutoff = new Date(now - 365 * DAY).toISOString();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us";

  const { data: orders } = await orderRepo.findDeliveredBefore(admin, cutoff);

  const byClient = new Map<string, { partnerId: string | null; deliveredAt: string }>();
  for (const o of orders || []) {
    if (!o.client_id) continue;
    const prev = byClient.get(o.client_id);
    if (!prev || o.delivered_at > prev.deliveredAt) {
      byClient.set(o.client_id, { partnerId: o.partner_id || null, deliveredAt: o.delivered_at });
    }
  }

  let sent = 0;
  for (const [clientId, info] of Array.from(byClient.entries())) {
    const { data: client } = await clientRepo.getReminderStateById(admin, clientId);
    const profileId = client?.profile_id;
    if (!profileId) continue;

    const lastSent = client?.last_annual_review_sent_at;
    if (lastSent && now - new Date(lastSent).getTime() < 360 * DAY) continue;

    if (!(await wantsNotification(admin, profileId, "annual_review"))) continue;

    const { data: profile } = await profileRepo.getEmailAndNameById(admin, profileId);
    if (!profile?.email) continue;

    await sendAnnualReviewEmail({
      to: profile.email,
      loginLink: `${baseUrl}/auth/login?email=${encodeURIComponent(profile.email)}`,
      partnerId: info.partnerId,
      clientName: profile.full_name,
      deliveredAt: info.deliveredAt,
    });
    await clientRepo.stampAnnualReview(admin, clientId);
    await auditLogRepo.insertEntry(admin, {
      action: "email.annual_review",
      resource_type: "client",
      resource_id: clientId,
    });
    sent++;
  }

  return ok({ ok: true, eligible: byClient.size, sent });
});
