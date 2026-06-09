import { type NextRequest } from "next/server";
import { getAppUrl } from "@/lib/config/appUrl";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import { sendSubscriptionExpiryEmail } from "@/lib/email";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const runtime = "nodejs";

const DAY = 24 * 60 * 60 * 1000;
// Notify at each milestone as a cancelled subscription's paid term winds down.
const MILESTONES = [30, 7, 1] as const;
const ACTION = "email.subscription_expiry";

// Smallest milestone the days-remaining still falls within (e.g. 5 days → 7,
// 1 day → 1). Returns null when access is more than the largest milestone away.
function bucketFor(daysRemaining: number): number | null {
  const ascending = [...MILESTONES].sort((a, b) => a - b);
  return ascending.find((m) => daysRemaining <= m) ?? null;
}

export const GET = withRoute(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return fail("unauthorized", 401);
  }

  const admin = createAdminClient();
  const now = Date.now();
  const baseUrl = getAppUrl();
  const nowIso = new Date(now).toISOString();
  const untilIso = new Date(now + 30 * DAY).toISOString();

  const { data: clients } = await clientRepo.findExpiringCancelled(admin, nowIso, untilIso);

  let sent = 0;
  for (const client of clients || []) {
    const expiryIso = client.vault_subscription_expiry;
    if (!expiryIso || !client.profile_id) continue;

    const expiryMs = new Date(expiryIso).getTime();
    const daysRemaining = Math.max(0, Math.ceil((expiryMs - now) / DAY));
    const milestone = bucketFor(daysRemaining);
    if (!milestone) continue;

    // Dedupe: skip if this milestone was already emailed in the current term.
    const sinceIso = new Date(expiryMs - 31 * DAY).toISOString();
    const { data: prior } = await auditLogRepo.findByResourceActionSince(admin, client.id, ACTION, sinceIso);
    const alreadySent = (prior || []).some(
      (row) => (row.metadata as { milestone?: number } | null)?.milestone === milestone,
    );
    if (alreadySent) continue;

    const { data: profile } = await profileRepo.getEmailAndNameById(admin, client.profile_id);
    if (!profile?.email) continue;

    const expiryDate = new Date(expiryMs).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    await sendSubscriptionExpiryEmail({
      to: profile.email,
      fullName: profile.full_name,
      partnerId: client.partner_id,
      daysRemaining,
      expiryDate,
      dashboardUrl: `${baseUrl}/dashboard/vault`,
    });
    await auditLogRepo.insertEntry(admin, {
      action: ACTION,
      resource_type: "client",
      resource_id: client.id,
      metadata: { milestone, expiry: expiryIso },
    });
    sent++;
  }

  return ok({ ok: true, eligible: (clients || []).length, sent });
});
