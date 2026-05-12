/**
 * Cron: every 15 min. For requests where:
 *   vault_unlock_approved = true
 *   owner_vetoed_at IS NULL
 *   unlock_window_expires_at <= now()
 *   trustee_email_notified_at IS NULL
 * → issue trustee access token, store hash + 7d expiry, email unlock link.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import { issueTrusteeToken, hashToken } from "@/lib/security/trusteeToken";

export const runtime = "nodejs";
const resend = new Resend(process.env.RESEND_API_KEY);
const ACCESS_TTL_SECONDS = 7 * 24 * 3600;

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

  const { data: ready, error } = await db
    .from("farewell_verification_requests")
    .select("id, client_id, trustee_email, trustee_id, unlock_window_expires_at")
    .eq("vault_unlock_approved", true)
    .is("owner_vetoed_at", null)
    .is("trustee_email_notified_at", null)
    .lte("unlock_window_expires_at", now.toISOString())
    .limit(50);

  if (error) {
    console.error("[window-expired] query failed:", error);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  let issued = 0;
  for (const r of ready || []) {
    const token = issueTrusteeToken(r.id, r.trustee_email, ACCESS_TTL_SECONDS);
    const expiresAt = new Date(now.getTime() + ACCESS_TTL_SECONDS * 1000);

    const { error: upErr } = await db
      .from("farewell_verification_requests")
      .update({
        trustee_access_token_hash: hashToken(token),
        access_expires_at: expiresAt.toISOString(),
        trustee_email_notified_at: now.toISOString(),
      })
      .eq("id", r.id);
    if (upErr) { console.error("[window-expired] update failed:", upErr); continue; }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us";
    const unlockUrl = `${baseUrl}/trustee/unlock?token=${token}`;

    try {
      await resend.emails.send({
        from: "EstateVault <info@estatevault.us>",
        to: r.trustee_email,
        subject: "Vault Access Approved — Open Within 7 Days",
        html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#2D2D2D;">
          <h1 style="color:#1C3557;">Vault Access Approved</h1>
          <p>Your request has been approved and the review period has ended. You can now access the vault.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${unlockUrl}" style="background:#C9A84C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-weight:600;">Open Vault</a>
          </div>
          <p style="color:#6b7280;font-size:13px;">This link expires on <strong>${expiresAt.toUTCString()}</strong>. You will be sent a one-time code by email to confirm your identity.</p>
          <p style="color:#9ca3af;font-size:11px;margin-top:24px;">EstateVault</p>
        </div>`,
      });
      await db.from("trustee_access_audit").insert({
        trustee_id: r.trustee_id,
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

  return NextResponse.json({ ok: true, checked: ready?.length || 0, issued });
}
