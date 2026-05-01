/**
 * Create a dummy enterprise partner account.
 * Usage: npx tsx scripts/create-enterprise-partner-dummy.ts
 */

import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

const EMAIL = "enterprise@estatevault.us";
const FULL_NAME = "Enterprise Partner";
const PASSWORD = "Enterprise!2026";
const COMPANY = "Acme Enterprise Group";
const SUBDOMAIN = "acme-enterprise";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing env vars");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Get or create auth user
  let userId: string = "";

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", EMAIL)
    .maybeSingle();

  if (existingProfile) {
    userId = existingProfile.id;
    await supabase.auth.admin.updateUserById(userId, { password: PASSWORD });
  } else {
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME, user_type: "partner" },
    });
    if (error || !newUser.user) {
      console.error("Auth create failed:", error?.message);
      process.exit(1);
    }
    userId = newUser.user.id;
  }

  // 2. Upsert profile as partner
  await supabase.from("profiles").upsert({
    id: userId,
    email: EMAIL,
    full_name: FULL_NAME,
    user_type: "partner",
  });

  // 3. Upsert partner row
  const { data: existingPartner } = await supabase
    .from("partners")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();

  const partnerData = {
    profile_id: userId,
    company_name: COMPANY,
    business_url: "https://acme-enterprise.example.com",
    product_name: "Legacy Protection",
    tier: "enterprise",
    status: "active",
    subdomain: SUBDOMAIN,
    sender_name: COMPANY,
    sender_email: EMAIL,
    annual_fee_paid: true,
    annual_fee_paid_at: new Date().toISOString(),
    onboarding_step: 99,
    onboarding_completed: true,
  };

  if (existingPartner) {
    const { error } = await supabase
      .from("partners")
      .update(partnerData)
      .eq("id", existingPartner.id);
    if (error) console.error("Partner update err:", error.message);
  } else {
    const { error } = await supabase.from("partners").insert(partnerData);
    if (error) console.error("Partner insert err:", error.message);
  }

  console.log("Enterprise partner ready!");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Company:  ${COMPANY}`);
  console.log(`  Tier:     enterprise`);
  console.log(`  Subdomain:${SUBDOMAIN}`);
}

main().catch(console.error);
