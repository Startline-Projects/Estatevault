/**
 * POST /api/trustee/unlock-verify
 * Body: { token, code }
 *
 * On success returns vault material for client-side reconstruction:
 *   - shareA (plain, server-held)
 *   - shareC (decrypted from vault_master_share_c_enc with TRUSTEE_RELEASE_KEY)
 *   - wrappedMkShamir (MK encrypted under shamir master_key)
 *
 * Browser combines shareA + shareC → master_key → unwraps MK → decrypts vault.
 * Burns the unlock token + OTP on success. Increments attempt counter on failure.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  verifyTrusteeToken,
  hashToken,
  hashOtp,
} from "@/lib/security/trusteeToken";
import { decryptShareC } from "@/lib/crypto/trusteeRelease";
import { byteaToBytes } from "@/lib/api/crypto";
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

function b64(b: Uint8Array): string {
  return Buffer.from(b).toString("base64");
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

  // Load owner crypto material.
  const { data: client } = await db
    .from("clients")
    .select("vault_master_share_a, vault_master_share_c_enc, vault_wrapped_mk_shamir, vault_shamir_version, kdf_params, kdf_salt, wrapped_mk_pass, pubkey_x25519, pubkey_ed25519")
    .eq("id", r.client_id)
    .single();
  if (!client?.vault_master_share_a || !client.vault_master_share_c_enc || !client.vault_wrapped_mk_shamir) {
    return NextResponse.json({ error: "vault not initialized for trustee access" }, { status: 409 });
  }

  let shareCPlain: Uint8Array;
  try {
    shareCPlain = await decryptShareC(byteaToBytes(client.vault_master_share_c_enc));
  } catch (e) {
    console.error("[unlock-verify] decrypt share C failed:", e);
    return NextResponse.json({ error: "release key error" }, { status: 500 });
  }

  // Burn token + OTP. Mark request as opened.
  await db.from("farewell_verification_requests").update({
    trustee_access_token_hash: null,
    otp_email_hash: null,
    otp_email_expires_at: null,
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
    shareA: b64(byteaToBytes(client.vault_master_share_a)),
    shareC: b64(shareCPlain),
    wrappedMkShamir: b64(byteaToBytes(client.vault_wrapped_mk_shamir)),
    shamirVersion: client.vault_shamir_version ?? 1,
    pubX25519: b64(byteaToBytes(client.pubkey_x25519)),
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
