/**
 * Cron: every 12h, re-email the owner-veto link for any active unlock window.
 * Vercel cron auth via CRON_SECRET header.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import { issueVetoToken } from "@/lib/security/vetoToken";
import { createHash } from "crypto";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

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
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = admin();
  const now = new Date();
  const { data: active } = await db
    .from("farewell_verification_requests")
    .select("id, client_id, unlock_window_expires_at")
    .eq("vault_unlock_approved", true)
    .is("owner_vetoed_at", null)
    .gt("unlock_window_expires_at", now.toISOString());

  let sent = 0;
  for (const r of active || []) {
    const expiresAt = new Date(r.unlock_window_expires_at);
    const ttlSec = Math.max(60, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    const token = issueVetoToken(r.id, ttlSec);

    // Update token hash so the latest link always works (older still valid until ttl).
    await db.from("farewell_verification_requests").update({
      owner_veto_token_hash: createHash("sha256").update(token).digest("hex"),
    }).eq("id", r.id);

    const { data: client } = await db.from("clients").select("profile_id").eq("id", r.client_id).single();
    if (!client?.profile_id) continue;
    const { data: prof } = await db.from("profiles").select("email, full_name").eq("id", client.profile_id).single();
    if (!prof?.email) continue;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us";
    const vetoUrl = `${baseUrl}/farewell/owner-veto?token=${token}`;
    try {
      await resend.emails.send({
        from: "EstateVault <info@estatevault.us>",
        to: prof.email,
        subject: "REMINDER: Vault access pending — cancel if you're alive",
        html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#2D2D2D;">
          <h1 style="color:#1C3557;">Vault Access Pending</h1>
          <p>Hello ${prof.full_name || ""},</p>
          <p>A trustee has requested access to your EstateVault. Access will be granted on <strong>${expiresAt.toUTCString()}</strong> unless cancelled.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${vetoUrl}" style="background:#C9A84C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-weight:600;">I'm alive — Cancel Access</a>
          </div>
          <p style="color:#9ca3af;font-size:11px;">EstateVault</p>
        </div>`,
      });
      sent++;
    } catch (e) { console.error("[veto-reminder] send failed:", e); }
  }

  return NextResponse.json({ ok: true, checked: active?.length || 0, sent });
}
