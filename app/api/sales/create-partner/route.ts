import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Verify sales rep or admin using admin client (bypasses RLS)
  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
  if (profileErr || !profile || !["sales_rep", "admin"].includes(profile.user_type)) {
    console.error("Auth check failed:", profileErr, profile);
    return NextResponse.json({ error: "Not authorized as sales rep" }, { status: 403 });
  }

  const body = await request.json();
  const { companyName, ownerName, email, businessUrl, phone, state, professionalType, tier, source, notes, promoCode } = body;

  if (!companyName || !ownerName || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Generate slug from business URL
  const urlForSlug = (businessUrl || companyName).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const slug = urlForSlug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { data: existingPartner } = await admin.from("partners").select("id").eq("partner_slug", slug).single();
  if (existingPartner) {
    return NextResponse.json({ error: "A partner with this business URL already exists." }, { status: 409 });
  }

  // Generate temp password
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  let tempPassword = "";
  for (let i = 0; i < 12; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

  // Check if auth user already exists with this email
  const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", email).single();
  let userId: string;

  if (existingProfile) {
    // User already exists, reset their password to the new temp password
    userId = existingProfile.id;
    await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
      user_metadata: { full_name: ownerName, user_type: "partner" },
    });
  } else {
    // Create new auth user
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: ownerName, user_type: "partner" },
    });

    if (createErr || !newUser.user) {
      return NextResponse.json({ error: "Failed to create user: " + (createErr?.message || "unknown") }, { status: 500 });
    }
    userId = newUser.user.id;
  }

  // Force-set password again to ensure it's definitely applied
  await admin.auth.admin.updateUserById(userId, { password: tempPassword });

  // Ensure profile exists with partner type
  const { data: profileCheck } = await admin.from("profiles").select("id").eq("id", userId).single();
  if (!profileCheck) {
    await admin.from("profiles").insert({ id: userId, email, full_name: ownerName, user_type: "partner", phone, state: state || "Michigan" });
  } else {
    await admin.from("profiles").update({ user_type: "partner", full_name: ownerName, phone }).eq("id", userId);
  }

  // Validate promo code if provided
  const VALID_PARTNER_PROMOS: Record<string, boolean> = { FREE676: true };
  const validPromo = promoCode && VALID_PARTNER_PROMOS[promoCode.toUpperCase()] ? promoCode.toUpperCase() : null;

  // Create partner record
  const { data: partner, error: partnerErr } = await admin.from("partners").insert({
    profile_id: userId,
    company_name: companyName,
    business_url: businessUrl || "",
    tier: tier || "standard",
    status: "onboarding",
    partner_slug: slug,
    created_by: user.id,
    created_by_notes: notes || null,
    prospect_source: source || null,
    ...(validPromo ? { promo_code: validPromo, one_time_fee_paid: true, onboarding_step: 2 } : {}),
  }).select("id").single();

  if (partnerErr || !partner) {
    return NextResponse.json({ error: "Failed to create partner: " + (partnerErr?.message || "unknown") }, { status: 500 });
  }

  // Audit log
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "partner.created",
    resource_type: "partner",
    resource_id: partner.id,
    metadata: { company_name: companyName, tier, source, professional_type: professionalType },
  });

  // Send welcome email to partner
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: email,
      subject: "Welcome to EstateVault, Your Partner Account",
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #1C3557; font-size: 24px;">Welcome to EstateVault</h1>
          <p style="color: #2D2D2D; line-height: 1.6;">Hi ${ownerName},</p>
          <p style="color: #2D2D2D; line-height: 1.6;">
            Your partner account for <strong>${companyName}</strong> has been created.
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
  } catch (emailErr) {
    console.error("Partner welcome email failed:", emailErr);
  }

  return NextResponse.json({ partnerId: partner.id, email, tempPassword, slug });
}
