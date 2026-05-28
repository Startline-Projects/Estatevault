import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authSendVerifyLinkSchema } from "@/lib/validation/schemas";
import { generateUrlToken, storeLink } from "@/lib/auth/emailVerification";
import { resolveSenderForEmail, renderEmailHeader, renderEmailFooter, sendEmail, type EmailBrand } from "@/lib/email";
import { authRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function buildEmailHtml(verifyLink: string, brand: EmailBrand): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    ${renderEmailHeader(brand)}
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Confirm your email</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Click the button below to verify your email and continue with your order.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${verifyLink}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Verify Email
        </a>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#666;">Or copy and paste this URL into your browser:</p>
      <p style="margin:0 0 24px;font-size:12px;color:#999;word-break:break-all;">${verifyLink}</p>
      <p style="margin:24px 0 0;font-size:13px;color:#999;line-height:1.5;">
        This link expires in 30 minutes. If you didn&rsquo;t request this, ignore this email.
      </p>
    </div>
    ${renderEmailFooter(brand)}
  </div>
</body>
</html>`;
}

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = authSendVerifyLinkSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { email, sessionId, partnerSlug, partnerId } = parsed.data;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const session = String(sessionId || "").trim();

  if (!normalizedEmail || !session || session.length < 16) return fail("Email and sessionId required.", 400);

  const { success } = await authRateLimit.limit(`verify-link:${normalizedEmail}`);
  if (!success) return fail("Too many attempts. Wait a minute.", 429);

  const linkToken = generateUrlToken();
  storeLink(normalizedEmail, linkToken, session);

  const { origin } = new URL(req.url);
  const verifyLink = `${origin}/api/auth/verify-link?token=${encodeURIComponent(
    linkToken
  )}&email=${encodeURIComponent(normalizedEmail)}`;

  const sender = await resolveSenderForEmail({
    email: normalizedEmail,
    partnerId: partnerId || null,
    partnerSlug: partnerSlug || null,
  });

  try {
    await sendEmail({
      from: sender.from,
      replyTo: sender.replyTo,
      to: normalizedEmail,
      subject: "Confirm your email to continue",
      html: buildEmailHtml(verifyLink, sender.brand),
    });
  } catch {
    return fail("Failed to send email.", 500);
  }

  return ok({ success: true });
});
