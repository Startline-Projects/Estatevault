/**
 * POST /api/trustee/unlock-otp
 * Body: { token }
 * Verifies trustee access token, generates 6-digit OTP, emails to trustee.
 * Stores hashed OTP + 10-min expiry on request row.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import {
  verifyTrusteeToken,
  hashToken,
  generateOtp,
  hashOtp,
} from "@/lib/security/trusteeToken";

export const runtime = "nodejs";
const resend = new Resend(process.env.RESEND_API_KEY);
const OTP_TTL_SECONDS = 10 * 60;

function admin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export async function POST(req: Request) {
  let body: { token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const token = body.token;
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const v = verifyTrusteeToken(token);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const db = admin();
  const { data: r } = await db
    .from("farewell_verification_requests")
    .select("id, client_id, trustee_id, trustee_email, vault_unlock_approved, owner_vetoed_at, trustee_access_token_hash, access_expires_at")
    .eq("id", v.requestId)
    .single();
  if (!r) return NextResponse.json({ error: "request not found" }, { status: 404 });
  if (!r.vault_unlock_approved || r.owner_vetoed_at) {
    return NextResponse.json({ error: "access not granted" }, { status: 403 });
  }
  if (r.trustee_access_token_hash !== hashToken(token)) {
    return NextResponse.json({ error: "token mismatch" }, { status: 400 });
  }
  if (r.access_expires_at && new Date(r.access_expires_at) < new Date()) {
    return NextResponse.json({ error: "access expired" }, { status: 400 });
  }
  if (r.trustee_email.toLowerCase() !== v.trusteeEmail) {
    return NextResponse.json({ error: "email mismatch" }, { status: 400 });
  }

  const code = generateOtp();
  const otpExpires = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const codeHash = hashOtp(code, r.id);

  await db.from("farewell_verification_requests").update({
    otp_email_hash: codeHash,
    otp_email_expires_at: otpExpires.toISOString(),
    otp_email_attempts: 0,
  }).eq("id", r.id);

  try {
    await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: r.trustee_email,
      subject: `EstateVault verification code: ${code}`,
      html: `<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#2D2D2D;">
        <h1 style="color:#1C3557;">Your verification code</h1>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1C3557;text-align:center;margin:24px 0;">${code}</p>
        <p style="color:#6b7280;font-size:14px;">Enter this code on the vault access page. It expires in 10 minutes.</p>
        <p style="color:#9ca3af;font-size:11px;margin-top:24px;">If you didn't request this, ignore this email.</p>
      </div>`,
    });
  } catch (e) {
    console.error("[unlock-otp] email failed:", e);
    return NextResponse.json({ error: "email send failed" }, { status: 500 });
  }

  await db.from("trustee_access_audit").insert({
    trustee_id: r.trustee_id,
    client_id: r.client_id,
    request_id: r.id,
    action: "otp_sent",
  });

  return NextResponse.json({ ok: true, expiresAt: otpExpires.toISOString() });
}
