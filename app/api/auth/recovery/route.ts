import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { resolveSenderForEmail, renderEmailHeader, renderEmailFooter, getResend, type EmailBrand } from "@/lib/email";

export const dynamic = "force-dynamic";

function buildEmailHtml(resetLink: string, brand: EmailBrand): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    ${renderEmailHeader(brand)}
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Reset your password</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        We received a request to reset your password. Click the button below to choose a new one.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetLink}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Reset Password
        </a>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#666;">Or copy and paste this URL into your browser:</p>
      <p style="margin:0 0 24px;font-size:12px;color:#999;word-break:break-all;">${resetLink}</p>
      <p style="margin:24px 0 0;font-size:13px;color:#999;line-height:1.5;">
        This link will expire in 1 hour. If you didn&rsquo;t request this, you can safely ignore this email.
      </p>
    </div>
    ${renderEmailFooter(brand)}
  </div>
</body>
</html>`;
}

export const POST = withRoute(async (req: NextRequest) => {
  const { email } = await req.json();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) return ok({ success: true });

  const { origin } = new URL(req.url);
  const admin = createAdminClient();

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: normalizedEmail,
    options: { redirectTo: `${origin}/auth/reset-password` },
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("recovery generateLink failed:", linkErr);
    return ok({ success: true });
  }

  const resetLink = `${origin}/auth/reset-password?token_hash=${encodeURIComponent(
    linkData.properties.hashed_token
  )}&type=recovery`;

  const sender = await resolveSenderForEmail({ email: normalizedEmail });

  const { error: sendErr } = await getResend().emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: normalizedEmail,
    subject: `Reset your ${sender.brand.companyName} password`,
    html: buildEmailHtml(resetLink, sender.brand),
  });

  if (sendErr) {
    console.error("recovery Resend error:", sendErr);
  }

  return ok({ success: true });
});
