import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Auth check — only allow admin/sales users
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
    if (!profile || !["admin", "sales"].includes(profile.user_type)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const displayName = name || "Partner";

    await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: email,
      subject: "Your EstateVault Partner Account is Active",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#1C3557;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">EstateVault</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Welcome to the network, ${displayName}!</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Your bar credentials have been verified and your EstateVault partner account is now active.
        You can log in to your partner dashboard to start managing clients and earning revenue.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="https://pro.estatevault.com/login" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Go to Partner Dashboard
        </a>
      </div>
      <p style="margin:32px 0 0;font-size:13px;color:#999;line-height:1.5;">
        If you have any questions, contact us at
        <a href="mailto:support@estatevault.com" style="color:#1C3557;">support@estatevault.com</a>.
      </p>
    </div>
    <div style="background:#f8f9fa;padding:24px 32px;border-top:1px solid #e5e5e5;">
      <p style="margin:0 0 8px;font-size:13px;color:#1C3557;font-weight:600;">EstateVault</p>
      <p style="margin:0 0 12px;font-size:12px;color:#999;">Protect Everything That Matters</p>
      <p style="margin:0;font-size:11px;color:#bbb;">
        &copy; 2025 EstateVault Technologies LLC
      </p>
    </div>
  </div>
</body>
</html>`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send partner activation email:", error);
    return NextResponse.json(
      { error: "Failed to send activation email" },
      { status: 500 }
    );
  }
}
