import { NextResponse } from "next/server";
import { Resend } from "resend";
import { generateUrlToken, storeLink } from "@/lib/auth/emailVerification";
import { resolveSenderForEmail, renderEmailHeader, renderEmailFooter, type EmailBrand } from "@/lib/email";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

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

export async function POST(request: Request) {
  try {
    const { email, sessionId, partnerSlug, partnerId } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const session = String(sessionId || "").trim();

    if (!normalizedEmail || !session || session.length < 16) {
      return NextResponse.json({ error: "Email and sessionId required." }, { status: 400 });
    }

    if (!checkRateLimit(normalizedEmail)) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a minute." },
        { status: 429 }
      );
    }

    const linkToken = generateUrlToken();
    storeLink(normalizedEmail, linkToken, session);

    const { origin } = new URL(request.url);
    const verifyLink = `${origin}/api/auth/verify-link?token=${encodeURIComponent(
      linkToken
    )}&email=${encodeURIComponent(normalizedEmail)}`;

    const sender = await resolveSenderForEmail({
      email: normalizedEmail,
      partnerId: partnerId || null,
      partnerSlug: partnerSlug || null,
    });

    const { error: sendErr } = await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
      to: normalizedEmail,
      subject: "Confirm your email to continue",
      html: buildEmailHtml(verifyLink, sender.brand),
    });

    if (sendErr) {
      console.error("send-verify-link Resend error:", sendErr);
      return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("send-verify-link error:", err);
    return NextResponse.json({ error: "Failed to send link." }, { status: 500 });
  }
}
