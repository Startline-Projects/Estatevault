import { type NextRequest } from "next/server";
import { getAppUrl } from "@/lib/config/appUrl";
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
  const baseUrl = getAppUrl();

  const { data: orders } = await orderRepo.findDeliveredBefore(admin, cutoff);

  const byClient = new Map<string, { partnerId: string | null; deliveredAt: string }>();
  for (const doc of orders || []) {
    // Each row is a document with a nested orders object (from the join).
    const order = doc.orders as unknown as { client_id: string | null; partner_id: string | null };
    const clientId = order?.client_id;
    if (!clientId || !doc.delivered_at) continue;
    const prev = byClient.get(clientId);
    if (!prev || doc.delivered_at > prev.deliveredAt) {
      byClient.set(clientId, { partnerId: order.partner_id || null, deliveredAt: doc.delivered_at });
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
