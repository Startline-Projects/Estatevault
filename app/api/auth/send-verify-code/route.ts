import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { generateCode, storeCode } from "@/lib/auth/emailVerification";
import { resolveSenderForEmail, getResend } from "@/lib/email";
import { authRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function buildEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#1C3557;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">EstateVault</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Your verification code</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Enter this code on the signup page to verify your email address.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <div style="display:inline-block;padding:20px 36px;background:#f8f9fa;border:2px solid #C9A84C;border-radius:14px;font-size:32px;font-weight:700;letter-spacing:8px;color:#1C3557;font-family:'Courier New',monospace;">
          ${code}
        </div>
      </div>
      <p style="margin:24px 0 0;font-size:13px;color:#999;line-height:1.5;">
        This code will expire in 10 minutes. If you didn&rsquo;t request this, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#f8f9fa;padding:24px 32px;border-top:1px solid #e5e5e5;">
      <p style="margin:0;font-size:11px;color:#bbb;line-height:1.5;">&copy; 2026 EstateVault Technologies LLC</p>
    </div>
  </div>
</body>
</html>`;
}

export const POST = withRoute(async (req: NextRequest) => {
  const { email, partnerSlug, partnerId } = await req.json();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) return fail("Email is required.", 400);

  const { success } = await authRateLimit.limit(`verify-code:${normalizedEmail}`);
  if (!success) return fail("Too many attempts. Please wait a minute and try again.", 429);

  const code = generateCode();
  storeCode(normalizedEmail, code);

  const sender = await resolveSenderForEmail({
    email: normalizedEmail,
    partnerId: partnerId || null,
    partnerSlug: partnerSlug || null,
  });

  const { error: sendErr } = await getResend().emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: normalizedEmail,
    subject: `Your EstateVault code: ${code}`,
    html: buildEmailHtml(code),
  });

  if (sendErr) {
    console.error("send-verify-code Resend error:", sendErr);
    return fail("Failed to send email.", 500);
  }

  return ok({ success: true });
});
