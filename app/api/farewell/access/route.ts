import { NextRequest } from "next/server";
import { getAppUrl } from "@/lib/config/appUrl";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { issueTrusteeToken, hashToken } from "@/lib/security/trusteeToken";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { bytesToBytea } from "@/lib/api/crypto";
import { blindIndex, normalize } from "@/lib/crypto/blindIndex";
import { authRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import * as fvRepo from "@/lib/repos/server/farewellVerificationRepo";
import { farewellAccessSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

const ACCESS_TTL_SECONDS = 7 * 24 * 3600;
const RESEND_COOLDOWN_MS = 60 * 1000;

export const POST = withRoute(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { success } = await authRateLimit.limit(`farewell-access:${ip}`);
  if (!success) return fail("Too many requests", 429);

  const body = await req.json();
  const parsed = farewellAccessSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { clientId, trusteeEmail } = parsed.data;

  const admin = createAdminClient();

  const { data: ownerClient } = await admin
    .from("clients")
    .select("id, wrapped_dek")
    .eq("id", clientId)
    .maybeSingle();
  if (!ownerClient) {
    return fail("No trustee account found for this email. Please check your email address.", 404);
  }

  const dek = await getOrCreateUserDek(admin, ownerClient);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  let emailBlindHex: string;
  try {
    emailBlindHex = bytesToBytea(blindIndex(indexKey, normalize(trusteeEmail)));
  } finally {
    zero(indexKey);
    zero(dek);
  }

  const { data: trustee } = await admin
    .from("vault_trustees")
    .select("id, status, confirmed_at, access_scope")
    .eq("client_id", clientId)
    .eq("email_blind", emailBlindHex)
    .maybeSingle();

  if (!trustee) {
    return fail("No trustee account found for this email. Please check your email address.", 404);
  }

  if (!trustee.confirmed_at || trustee.status === "pending") {
    return ok({ state: "trustee_not_confirmed" });
  }

  const { data: fvReq } = await admin
    .from("farewell_verification_requests")
    .select("id, status, vault_unlock_approved, owner_vetoed_at, certificate_storage_path, submitted_at, unlock_window_expires_at, access_expires_at, trustee_email_notified_at")
    .eq("client_id", clientId)
    .ilike("trustee_email", trusteeEmail)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fvReq) return ok({ state: "no_request" });
  if (fvReq.owner_vetoed_at) return ok({ state: "vetoed" });
  if (fvReq.status === "rejected") return ok({ state: "rejected" });
  if (fvReq.status !== "approved" || !fvReq.vault_unlock_approved) return ok({ state: "pending_approval" });

  const now = Date.now();
  const lastSentAt = fvReq.trustee_email_notified_at ? new Date(fvReq.trustee_email_notified_at).getTime() : 0;
  if (now - lastSentAt < RESEND_COOLDOWN_MS) {
    return ok({ state: "email_sent", cooldown: true, trusteeEmail });
  }

  const token = issueTrusteeToken(fvReq.id, trusteeEmail, ACCESS_TTL_SECONDS);
  const accessExpiresAt = new Date(now + ACCESS_TTL_SECONDS * 1000);

  await admin.from("farewell_verification_requests").update({
    trustee_access_token_hash: hashToken(token),
    access_expires_at: accessExpiresAt.toISOString(),
    trustee_email_notified_at: new Date(now).toISOString(),
  }).eq("id", fvReq.id);

  const baseUrl = getAppUrl();
  const unlockUrl = `${baseUrl}/trustee/unlock?token=${token}`;

  try {
    await sendEmail({
      from: "EstateVault <info@estatevault.us>",
      to: trusteeEmail,
      subject: "Your Vault Sign-In Link",
      html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#2D2D2D;">
        <h1 style="color:#1C3557;">Sign In to View the Vault</h1>
        <p>You requested access to the vault associated with this email. Click the button below to verify your identity and open the vault.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${unlockUrl}" style="background:#C9A84C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-weight:600;">Open Vault</a>
        </div>
        <p style="color:#6b7280;font-size:13px;">This link expires on <strong>${accessExpiresAt.toUTCString()}</strong>. You will receive a one-time code by email to confirm your identity once you open the link.</p>
        <p style="color:#9ca3af;font-size:11px;margin-top:24px;">If you didn't request this, you can ignore this email.</p>
      </div>`,
    });
  } catch (e) {
    console.error("[farewell/access] sign-in email failed:", e);
    return fail("Failed to send sign-in email", 500);
  }

  await fvRepo.insertTrusteeAudit(admin, {
    trustee_id: trustee.id,
    client_id: clientId,
    request_id: fvReq.id,
    action: "signin_email_sent",
    metadata: { trustee_email: trusteeEmail },
  });

  return ok({ state: "email_sent", trusteeEmail });
});
