import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { generateTempPassword } from "@/lib/utils/generate-password";

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

  // Admin only
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (!profile || profile.user_type !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { fullName, email } = body;

  if (!fullName || !email) {
    return NextResponse.json({ error: "Full name and email are required" }, { status: 400 });
  }

  const tempPassword = generateTempPassword();

  // Create auth user
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, user_type: "sales_rep" },
  });

  if (createErr || !newUser.user) {
    return NextResponse.json(
      { error: "Failed to create user: " + (createErr?.message || "unknown") },
      { status: 500 }
    );
  }

  // Create profile
  await admin.from("profiles").upsert({
    id: newUser.user.id,
    email,
    full_name: fullName,
    user_type: "sales_rep",
  });

  // Audit log
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "sales_rep.created",
    resource_type: "profile",
    resource_id: newUser.user.id,
    metadata: { email, full_name: fullName },
  });

  // Send welcome email
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "EstateVault <noreply@estatevault.us>",
      to: email,
      subject: "Welcome to EstateVault — Your Sales Account",
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #1C3557; font-size: 24px;">Welcome to EstateVault</h1>
          <p style="color: #2D2D2D; line-height: 1.6;">
            Hi ${fullName},
          </p>
          <p style="color: #2D2D2D; line-height: 1.6;">
            Your sales account has been created. Use the credentials below to sign in:
          </p>
          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Email</p>
            <p style="margin: 0 0 16px 0; color: #1C3557; font-weight: 600;">${email}</p>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Temporary Password</p>
            <p style="margin: 0; color: #1C3557; font-weight: 600; font-family: monospace; font-size: 18px;">${tempPassword}</p>
          </div>
          <a href="https://www.estatevault.us/auth/login"
             style="display: block; text-align: center; background: #C9A84C; color: white; text-decoration: none; padding: 14px 24px; border-radius: 999px; font-weight: 600; font-size: 14px;">
            Sign In to Your Account
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px; text-align: center;">
            Please change your password after signing in.
          </p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error("Welcome email failed:", emailErr);
  }

  return NextResponse.json({
    success: true,
    userId: newUser.user.id,
    email,
    tempPassword,
  });
}
