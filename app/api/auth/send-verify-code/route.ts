import { NextResponse } from "next/server";
import { Resend } from "resend";
import { generateCode, storeCode } from "@/lib/auth/emailVerification";
import { resolveSenderForEmail } from "@/lib/email";

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

export async function POST(request: Request) {
  try {
    const { email, partnerSlug, partnerId } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!checkRateLimit(normalizedEmail)) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    const code = generateCode();
    storeCode(normalizedEmail, code);

    const sender = await resolveSenderForEmail({
      email: normalizedEmail,
      partnerId: partnerId || null,
      partnerSlug: partnerSlug || null,
    });

    const { error: sendErr } = await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
      to: normalizedEmail,
      subject: `Your EstateVault code: ${code}`,
      html: buildEmailHtml(code),
    });

    if (sendErr) {
      console.error("send-verify-code Resend error:", sendErr);
      return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("send-verify-code error:", err);
    return NextResponse.json({ error: "Failed to send code." }, { status: 500 });
  }
}
