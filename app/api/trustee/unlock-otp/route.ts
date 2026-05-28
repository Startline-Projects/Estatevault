import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import {
  verifyTrusteeToken,
  hashToken,
  generateOtp,
  hashOtp,
} from "@/lib/security/trusteeToken";
import { sendTrusteeOtpEmail } from "@/lib/email";
import * as fvRepo from "@/lib/repos/server/farewellVerificationRepo";

export const runtime = "nodejs";
const OTP_TTL_SECONDS = 10 * 60;

export const POST = withRoute(async (req: NextRequest) => {
  let body: { token?: string };
  try { body = await req.json(); } catch { return fail("bad json", 400); }
  const token = body.token;
  if (!token) return fail("missing token", 400);

  const v = verifyTrusteeToken(token);
  if (!v.ok) return fail(v.error, 400);

  const admin = createAdminClient();
  const { data: r } = await fvRepo.getByIdForOtp(admin, v.requestId);
  if (!r) return fail("request not found", 404);
  if (!r.vault_unlock_approved || r.owner_vetoed_at) return fail("access not granted", 403);
  if (r.trustee_access_token_hash !== hashToken(token)) return fail("token mismatch", 400);
  if (r.access_expires_at && new Date(r.access_expires_at) < new Date()) return fail("access expired", 400);
  if (r.trustee_email.toLowerCase() !== v.trusteeEmail) return fail("email mismatch", 400);

  const code = generateOtp();
  const otpExpires = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const codeHash = hashOtp(code, r.id);

  await fvRepo.storeOtp(admin, r.id, codeHash, otpExpires.toISOString());

  try {
    await sendTrusteeOtpEmail({ to: r.trustee_email, code });
  } catch (e) {
    console.error("[unlock-otp] email failed:", e);
    return fail("email send failed", 500);
  }

  await fvRepo.insertTrusteeAudit(admin, {
    trustee_id: r.trustee_id,
    client_id: r.client_id,
    request_id: r.id,
    action: "otp_sent",
  });

  return ok({ ok: true, expiresAt: otpExpires.toISOString() });
});
