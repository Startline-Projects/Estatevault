import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { resolveSenderForEmail, getResend } from "@/lib/email";
import { authRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function buildVerifyEmailHtml(verifyLink: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#1C3557;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">EstateVault</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Confirm your email</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Click the button below to confirm your email and activate your EstateVault account.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${verifyLink}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Confirm Email
        </a>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#666;">Or copy and paste this URL:</p>
      <p style="margin:0;font-size:12px;color:#999;word-break:break-all;">${verifyLink}</p>
    </div>
    <div style="background:#f8f9fa;padding:24px 32px;border-top:1px solid #e5e5e5;">
      <p style="margin:0;font-size:11px;color:#bbb;line-height:1.5;">&copy; 2026 EstateVault Technologies LLC</p>
    </div>
  </div>
</body>
</html>`;
}

export const POST = withRoute(async (req: NextRequest) => {
  const { email } = await req.json();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) return ok({ success: true });

  const { success } = await authRateLimit.limit(`resend-verify:${normalizedEmail}`);
  if (!success) return ok({ success: true });

  const { origin } = new URL(req.url);
  const admin = createAdminClient();

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
    options: { redirectTo: `${origin}/auth/verify` },
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("resend-verification generateLink failed:", linkErr);
    return ok({ success: true });
  }

  const verifyLink = `${origin}/auth/verify?token_hash=${encodeURIComponent(
    linkData.properties.hashed_token
  )}&type=magiclink`;

  const sender = await resolveSenderForEmail({ email: normalizedEmail });

  const { error: sendErr } = await getResend().emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: normalizedEmail,
    subject: "Confirm your EstateVault email",
    html: buildVerifyEmailHtml(verifyLink),
  });

  if (sendErr) {
    console.error("resend-verification Resend error:", sendErr);
  }

  return ok({ success: true });
});
