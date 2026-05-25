/**
 * POST /api/trustee/unlock-verify
 * Body: { token, code }
 *
 * Option A (server-managed): verifies the emailed OTP, then issues a trustee
 * session cookie. Vault content is decrypted server-side on demand (see
 * /api/trustee/vault/items and /api/trustee/vault/file-key) — no key material
 * is returned to the browser. Burns the OTP on success; the access token stays
 * valid until access_expires_at so the trustee can re-enter from the email link.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  verifyTrusteeToken,
  hashToken,
  hashOtp,
} from "@/lib/security/trusteeToken";
import { issueSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/security/trusteeSession";

export const runtime = "nodejs";
const MAX_OTP_ATTEMPTS = 5;

function admin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export async function POST(req: Request) {
  let body: { token?: string; code?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const token = body.token, code = (body.code || "").trim();
  if (!token || !code) return NextResponse.json({ error: "missing token or code" }, { status: 400 });
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "bad code format" }, { status: 400 });

  const v = verifyTrusteeToken(token);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const db = admin();
  const { data: r } = await db
    .from("farewell_verification_requests")
    .select("id, client_id, trustee_id, trustee_email, vault_unlock_approved, owner_vetoed_at, trustee_access_token_hash, access_expires_at, otp_email_hash, otp_email_expires_at, otp_email_attempts")
    .eq("id", v.requestId)
    .single();
  if (!r) return NextResponse.json({ error: "request not found" }, { status: 404 });
  if (!r.vault_unlock_approved || r.owner_vetoed_at) {
    return NextResponse.json({ error: "access revoked" }, { status: 403 });
  }
  if (r.trustee_access_token_hash !== hashToken(token)) {
    return NextResponse.json({ error: "token mismatch" }, { status: 400 });
  }
  if (r.access_expires_at && new Date(r.access_expires_at) < new Date()) {
    return NextResponse.json({ error: "access expired" }, { status: 400 });
  }
  if (!r.otp_email_hash || !r.otp_email_expires_at) {
    return NextResponse.json({ error: "no otp issued" }, { status: 400 });
  }
  if (new Date(r.otp_email_expires_at) < new Date()) {
    return NextResponse.json({ error: "code expired" }, { status: 400 });
  }
  if ((r.otp_email_attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
    return NextResponse.json({ error: "too many attempts" }, { status: 429 });
  }

  const expected = hashOtp(code, r.id);
  if (expected !== r.otp_email_hash) {
    await db.from("farewell_verification_requests")
      .update({ otp_email_attempts: (r.otp_email_attempts ?? 0) + 1 })
      .eq("id", r.id);
    await db.from("trustee_access_audit").insert({
      trustee_id: r.trustee_id, client_id: r.client_id, request_id: r.id, action: "otp_failed",
    });
    return NextResponse.json({ error: "wrong code" }, { status: 401 });
  }

  // Burn OTP only — keep the access token valid until access_expires_at (7d)
  // so the trustee can re-enter from the email link if their session ends.
  // Each new sign-in still requires a fresh OTP via /unlock-otp.
  await db.from("farewell_verification_requests").update({
    otp_email_hash: null,
    otp_email_expires_at: null,
    otp_email_attempts: 0,
  }).eq("id", r.id);

  await db.from("trustee_access_audit").insert({
    trustee_id: r.trustee_id, client_id: r.client_id, request_id: r.id, action: "unlocked",
  });

  const session = issueSession({
    requestId: r.id,
    clientId: r.client_id,
    trusteeId: r.trustee_id,
    trusteeEmail: r.trustee_email,
  });

  const res = NextResponse.json({
    ok: true,
    accessExpiresAt: r.access_expires_at,
    sessionExpiresAt: new Date(session.expiresAt).toISOString(),
  });
  res.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return res;
}
