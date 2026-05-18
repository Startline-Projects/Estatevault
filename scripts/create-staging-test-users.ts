/**
 * Create test users in staging Supabase.
 * Usage: npx tsx scripts/create-staging-test-users.ts
 *
 * Requires .env.local pointing at STAGING with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

const PASSWORD = "TestPass123!";

const STAGING_HOST = "alrlaywoqvomluexpsvq.supabase.co";

type Role = "admin" | "partner" | "client" | "review_attorney" | "sales_rep";

type TestUser = {
  email: string;
  full_name: string;
  user_type: Role;
  partner_tier?: "standard" | "enterprise";
  partner_company?: string;
  partner_subdomain?: string;
};

const USERS: TestUser[] = [
  {
    email: "test-admin@estatevault.test",
    full_name: "Test Admin",
    user_type: "admin",
  },
  {
    email: "test-partner-basic@estatevault.test",
    full_name: "Test Standard Partner",
    user_type: "partner",
    partner_tier: "standard",
    partner_company: "Test Standard Partner Co",
    partner_subdomain: "test-standard",
  },
  {
    email: "test-partner-ent@estatevault.test",
    full_name: "Test Enterprise Partner",
    user_type: "partner",
    partner_tier: "enterprise",
    partner_company: "Test Enterprise Partner Co",
    partner_subdomain: "test-enterprise",
  },
  {
    email: "test-client@estatevault.test",
    full_name: "Test Client",
    user_type: "client",
  },
  {
    email: "test-attorney@estatevault.test",
    full_name: "Test Attorney",
    user_type: "review_attorney",
  },
  {
    email: "test-sales@estatevault.test",
    full_name: "Test Sales Rep",
    user_type: "sales_rep",
  },
];

async function upsertUser(supabase: SupabaseClient, u: TestUser): Promise<void> {
  // 1. Auth user
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", u.email)
    .maybeSingle();

  let userId: string;
  if (existing) {
    userId = existing.id;
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, user_type: u.user_type },
    });
    if (error) throw new Error(`update auth ${u.email}: ${error.message}`);
  } else {
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, user_type: u.user_type },
    });
    if (error || !newUser.user) throw new Error(`create auth ${u.email}: ${error?.message}`);
    userId = newUser.user.id;
  }

  // 2. Profile
  const profile: Record<string, unknown> = {
    id: userId,
    email: u.email,
    full_name: u.full_name,
    user_type: u.user_type,
  };
  if (u.user_type === "review_attorney") {
    profile.is_payroll = true;
    profile.bar_number = "TEST-0001";
    profile.bar_verified = true;
    profile.bar_verified_at = new Date().toISOString();
  }
  if (u.user_type === "sales_rep") {
    profile.commission_rate = 0.1;
  }
  const { error: profErr } = await supabase.from("profiles").upsert(profile);
  if (profErr) throw new Error(`profile ${u.email}: ${profErr.message}`);

  // 3. Partner row if partner
  if (u.user_type === "partner") {
    const { data: existingPartner } = await supabase
      .from("partners")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    const partnerData = {
      profile_id: userId,
      company_name: u.partner_company!,
      business_url: `https://${u.partner_subdomain}.example.com`,
      product_name: "Legacy Protection",
      tier: u.partner_tier!,
      status: "active",
      subdomain: u.partner_subdomain!,
      sender_name: u.partner_company!,
      sender_email: u.email,
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
      if (error) throw new Error(`partner update ${u.email}: ${error.message}`);
    } else {
      const { error } = await supabase.from("partners").insert(partnerData);
      if (error) throw new Error(`partner insert ${u.email}: ${error.message}`);
    }
  }

  const tag = u.user_type === "partner" ? `${u.user_type}/${u.partner_tier}` : u.user_type;
  console.log(`  ✓ ${u.email.padEnd(40)} ${tag}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  if (!url.includes(STAGING_HOST)) {
    console.error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not staging (${STAGING_HOST}).`);
    console.error(`  Current: ${url}`);
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Staging: ${url}`);
  console.log(`Password (all users): ${PASSWORD}\n`);

  for (const u of USERS) {
    try {
      await upsertUser(supabase, u);
    } catch (e) {
      console.error(`  ✗ ${u.email}: ${(e as Error).message}`);
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
