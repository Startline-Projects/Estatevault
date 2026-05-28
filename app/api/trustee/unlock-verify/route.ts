import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import {
  verifyTrusteeToken,
  hashToken,
  hashOtp,
} from "@/lib/security/trusteeToken";
import { issueSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/security/trusteeSession";
import * as fvRepo from "@/lib/repos/server/farewellVerificationRepo";

export const runtime = "nodejs";
const MAX_OTP_ATTEMPTS = 5;

export const POST = withRoute(async (req: NextRequest) => {
  let body: { token?: string; code?: string };
  try { body = await req.json(); } catch { return fail("bad json", 400); }
  const token = body.token, code = (body.code || "").trim();
  if (!token || !code) return fail("missing token or code", 400);
  if (!/^\d{6}$/.test(code)) return fail("bad code format", 400);

  const v = verifyTrusteeToken(token);
  if (!v.ok) return fail(v.error, 400);

  const admin = createAdminClient();
  const { data: r } = await fvRepo.getByIdForOtp(admin, v.requestId);
  if (!r) return fail("request not found", 404);
  if (!r.vault_unlock_approved || r.owner_vetoed_at) return fail("access revoked", 403);
  if (r.trustee_access_token_hash !== hashToken(token)) return fail("token mismatch", 400);
  if (r.access_expires_at && new Date(r.access_expires_at) < new Date()) return fail("access expired", 400);
  if (!r.otp_email_hash || !r.otp_email_expires_at) return fail("no otp issued", 400);
  if (new Date(r.otp_email_expires_at) < new Date()) return fail("code expired", 400);
  if ((r.otp_email_attempts ?? 0) >= MAX_OTP_ATTEMPTS) return fail("too many attempts", 429);

  const expected = hashOtp(code, r.id);
  if (expected !== r.otp_email_hash) {
    await fvRepo.incrementOtpAttempts(admin, r.id, r.otp_email_attempts ?? 0);
    await fvRepo.insertTrusteeAudit(admin, {
      trustee_id: r.trustee_id, client_id: r.client_id, request_id: r.id, action: "otp_failed",
    });
    return fail("wrong code", 401);
  }

  await fvRepo.burnOtp(admin, r.id);
  await fvRepo.insertTrusteeAudit(admin, {
    trustee_id: r.trustee_id, client_id: r.client_id, request_id: r.id, action: "unlocked",
  });

  const session = issueSession({
    requestId: r.id,
    clientId: r.client_id,
    trusteeId: r.trustee_id,
    trusteeEmail: r.trustee_email,
  });

  const res = ok({
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
});
