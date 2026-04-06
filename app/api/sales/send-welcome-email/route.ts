import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
  if (!profile || !["sales_rep", "admin"].includes(profile.user_type)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { email, tempPassword, ownerName, companyName } = await request.json();
  if (!email || !tempPassword) {
    return NextResponse.json({ error: "Missing email or tempPassword" }, { status: 400 });
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: email,
      subject: "Welcome to EstateVault — Your Partner Account",
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #1C3557; font-size: 24px;">Welcome to EstateVault</h1>
          <p style="color: #2D2D2D; line-height: 1.6;">Hi ${ownerName || "there"},</p>
          <p style="color: #2D2D2D; line-height: 1.6;">
            Your partner account${companyName ? ` for <strong>${companyName}</strong>` : ""} has been created.
            Use the credentials below to sign in and complete your onboarding:
          </p>
          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Email</p>
            <p style="margin: 0 0 16px 0; color: #1C3557; font-weight: 600;">${email}</p>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Temporary Password</p>
            <p style="margin: 0; color: #1C3557; font-weight: 600; font-family: monospace; font-size: 18px;">${tempPassword}</p>
          </div>
          <a href="https://www.estatevault.us/pro/login"
             style="display: block; text-align: center; background: #C9A84C; color: white; text-decoration: none; padding: 14px 24px; border-radius: 999px; font-weight: 600; font-size: 14px;">
            Sign In to Your Partner Account
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px; text-align: center;">
            Please change your password after signing in.
          </p>
        </div>
      `,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Send welcome email failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
