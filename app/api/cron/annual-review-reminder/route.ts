/**
 * Cron: daily. Emails a yearly estate-plan review nudge to clients whose
 * plan was delivered ~1 year ago, then re-nudges yearly.
 * Gated by profiles.notification_preferences.annual_review.
 * Vercel cron auth via CRON_SECRET header.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendAnnualReviewEmail } from "@/lib/email";
import { wantsNotification } from "@/lib/notifications/prefs";

export const runtime = "nodejs";

const DAY = 24 * 60 * 60 * 1000;

function admin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = admin();
  const now = Date.now();
  const deliveredCutoff = new Date(now - 365 * DAY).toISOString();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us";

  // Delivered plans at least a year old. One client may have several; keep latest.
  const { data: orders } = await db
    .from("orders")
    .select("client_id, partner_id, delivered_at")
    .eq("status", "delivered")
    .not("delivered_at", "is", null)
    .lte("delivered_at", deliveredCutoff);

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
    const { data: client } = await db
      .from("clients")
      .select("profile_id, last_annual_review_sent_at")
      .eq("id", clientId)
      .maybeSingle();
    const profileId = client?.profile_id;
    if (!profileId) continue;

    // Send at most once per ~year (360d guard against daily-cron / tz drift).
    const lastSent = client?.last_annual_review_sent_at;
    if (lastSent && now - new Date(lastSent).getTime() < 360 * DAY) continue;

    if (!(await wantsNotification(db, profileId, "annual_review"))) continue;

    const { data: profile } = await db
      .from("profiles")
      .select("email, full_name")
      .eq("id", profileId)
      .maybeSingle();
    const email = profile?.email;
    if (!email) continue;

    await sendAnnualReviewEmail({
      to: email,
      loginLink: `${baseUrl}/auth/login?email=${encodeURIComponent(email)}`,
      partnerId: info.partnerId,
      clientName: profile?.full_name,
      deliveredAt: info.deliveredAt,
    });
    await db.from("clients").update({ last_annual_review_sent_at: new Date().toISOString() }).eq("id", clientId);
    await db.from("audit_log").insert({
      action: "email.annual_review",
      resource_type: "client",
      resource_id: clientId,
    });
    sent++;
  }

  return NextResponse.json({ ok: true, eligible: byClient.size, sent });
}
