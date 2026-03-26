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
  const { companyName, ownerName, email, businessUrl, phone, state, professionalType, tier, source, notes } = body;

  if (!companyName || !ownerName || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Generate slug
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Generate temp password
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  let tempPassword = "";
  for (let i = 0; i < 12; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

  // Create auth user for partner
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: ownerName, user_type: "partner" },
  });

  if (createErr || !newUser.user) {
    return NextResponse.json({ error: "Failed to create user: " + (createErr?.message || "unknown") }, { status: 500 });
  }

  // Ensure profile exists with partner type
  const { data: existingProfile } = await admin.from("profiles").select("id").eq("id", newUser.user.id).single();
  if (!existingProfile) {
    await admin.from("profiles").insert({ id: newUser.user.id, email, full_name: ownerName, user_type: "partner", phone, state: state || "Michigan" });
  } else {
    await admin.from("profiles").update({ user_type: "partner", full_name: ownerName, phone }).eq("id", newUser.user.id);
  }

  // Create partner record
  const { data: partner, error: partnerErr } = await admin.from("partners").insert({
    profile_id: newUser.user.id,
    company_name: companyName,
    business_url: businessUrl || "",
    tier: tier || "standard",
    status: "onboarding",
    partner_slug: slug,
    created_by: user.id,
    created_by_notes: notes || null,
    prospect_source: source || null,
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

  return NextResponse.json({ partnerId: partner.id, email, tempPassword, slug });
}
