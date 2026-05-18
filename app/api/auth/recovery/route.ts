import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

const resend = new Resend(process.env.RESEND_API_KEY);

function buildEmailHtml(resetLink: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#1C3557;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">EstateVault</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Reset your password</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        We received a request to reset your EstateVault password. Click the button below to choose a new one.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetLink}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Reset Password
        </a>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#666;">
        Or copy and paste this URL into your browser:
      </p>
      <p style="margin:0 0 24px;font-size:12px;color:#999;word-break:break-all;">
        ${resetLink}
      </p>
      <p style="margin:24px 0 0;font-size:13px;color:#999;line-height:1.5;">
        This link will expire in 1 hour. If you didn&rsquo;t request this, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#f8f9fa;padding:24px 32px;border-top:1px solid #e5e5e5;">
      <p style="margin:0;font-size:11px;color:#bbb;line-height:1.5;">
        &copy; 2026 EstateVault Technologies LLC
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const { origin } = new URL(request.url);
    const admin = createAdminClient();

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: `${origin}/auth/reset-password`,
      },
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      // Do not leak account existence — return success either way
      console.error("recovery generateLink failed:", linkErr);
      return NextResponse.json({ success: true });
    }

    const resetLink = `${origin}/auth/reset-password?token_hash=${encodeURIComponent(
      linkData.properties.hashed_token
    )}&type=recovery`;

    const { error: sendErr } = await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: normalizedEmail,
      subject: "Reset your EstateVault password",
      html: buildEmailHtml(resetLink),
    });

    if (sendErr) {
      console.error("recovery Resend error:", sendErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("recovery route error:", err);
    return NextResponse.json({ success: true });
  }
}
