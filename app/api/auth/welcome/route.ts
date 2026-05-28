import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { resolveSenderForEmail, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function buildWelcomeHtml(fullName: string, dashboardUrl: string): string {
  const greeting = fullName ? `Welcome, ${fullName}!` : "Welcome to EstateVault!";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#1C3557;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">EstateVault</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">${greeting}</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Your email is confirmed and your account is ready. EstateVault helps you protect everything that matters &mdash; documents, accounts, and the people you love.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Go to your dashboard
        </a>
      </div>
      <p style="margin:24px 0 0;font-size:13px;color:#999;line-height:1.5;">
        Need help? Reply to this email or contact <a href="mailto:info@estatevault.us" style="color:#1C3557;">info@estatevault.us</a>.
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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return fail("Not authenticated", 401);

  const admin = createAdminClient();

  if (user.user_metadata?.welcome_sent_at) return ok({ success: true, skipped: true });

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const fullName = (profile?.full_name || user.user_metadata?.full_name || "").trim();
  const { origin } = new URL(req.url);
  const dashboardUrl = `${origin}/dashboard`;

  const sender = await resolveSenderForEmail({ email: user.email });

  try {
    await sendEmail({
      from: sender.from,
      replyTo: sender.replyTo,
      to: user.email,
      subject: "Welcome to EstateVault",
      html: buildWelcomeHtml(fullName, dashboardUrl),
    });
  } catch {
    return fail("Email failed", 500);
  }

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata || {}),
      welcome_sent_at: new Date().toISOString(),
    },
  });

  return ok({ success: true });
});
