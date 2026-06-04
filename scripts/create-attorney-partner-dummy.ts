/**
 * Create a dummy ATTORNEY partner account configured for BUG-17 testing.
 * Sets up Case 4 routing: attorney partner WITH in-house estate attorney and a
 * custom_review_fee of $1,000 — so the webhook transfers $1,000 while checkout
 * only collects the fixed $300.
 *
 * Usage: npx tsx scripts/create-attorney-partner-dummy.ts
 */

import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

const EMAIL = "attorney-partner@estatevault.us";
const FULL_NAME = "Attorney Partner";
const PASSWORD = "Attorney!2026";
const COMPANY = "Lawful Legacy PLLC";
const SUBDOMAIN = "lawful-legacy";

// In-house reviewer (the attorney the partner "employs")
const REVIEWER_EMAIL = "reviewer@lawful-legacy.us";
const REVIEWER_NAME = "In-House Reviewer";

const CUSTOM_REVIEW_FEE = 100000; // $1,000 in cents — exceeds collected $300

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

  async function getOrCreateUser(email: string, fullName: string, password: string, userType: string) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      await supabase.auth.admin.updateUserById(existing.id, { password });
      await supabase.from("profiles").upsert({ id: existing.id, email, full_name: fullName, user_type: userType });
      return existing.id;
    }
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, user_type: userType },
    });
    if (error || !newUser.user) {
      console.error(`Auth create failed for ${email}:`, error?.message);
      process.exit(1);
    }
    await supabase.from("profiles").upsert({ id: newUser.user.id, email, full_name: fullName, user_type: userType });
    return newUser.user.id;
  }

  // 1. Reviewer attorney profile (target of inhouse_review_attorney_id)
  const reviewerId = await getOrCreateUser(REVIEWER_EMAIL, REVIEWER_NAME, PASSWORD, "review_attorney");

  // 2. Partner login user
  const userId = await getOrCreateUser(EMAIL, FULL_NAME, PASSWORD, "partner");

  // 3. Upsert attorney partner row (Case 4)
  const { data: existingPartner } = await supabase
    .from("partners")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();

  const partnerData = {
    profile_id: userId,
    company_name: COMPANY,
    business_url: "https://lawful-legacy.example.com",
    product_name: "Estate Protection",
    tier: "standard",
    status: "active",
    subdomain: SUBDOMAIN,
    sender_name: COMPANY,
    sender_email: EMAIL,
    professional_type: "attorney",
    has_inhouse_estate_attorney: true,
    inhouse_review_attorney_id: reviewerId,
    custom_review_fee: CUSTOM_REVIEW_FEE,
    // NOTE: leave stripe_account_id null for safe DB-only testing. To exercise the
    // real transfer, set this to a Stripe Connect test account id.
    annual_fee_paid: true,
    annual_fee_paid_at: new Date().toISOString(),
    onboarding_step: 99,
    onboarding_completed: true,
  };

  if (existingPartner) {
    const { error } = await supabase.from("partners").update(partnerData).eq("id", existingPartner.id);
    if (error) console.error("Partner update err:", error.message);
  } else {
    const { error } = await supabase.from("partners").insert(partnerData);
    if (error) console.error("Partner insert err:", error.message);
  }

  console.log("Attorney partner ready (BUG-17 Case 4)!");
  console.log(`  Login Email: ${EMAIL}`);
  console.log(`  Password:    ${PASSWORD}`);
  console.log(`  Company:     ${COMPANY}`);
  console.log(`  Subdomain:   ${SUBDOMAIN}`);
  console.log(`  Reviewer:    ${REVIEWER_EMAIL} (id ${reviewerId})`);
  console.log(`  custom_review_fee: ${CUSTOM_REVIEW_FEE} cents ($${CUSTOM_REVIEW_FEE / 100})`);
  console.log("  stripe_account_id: null (set to a Connect test acct to exercise the live transfer)");
}

main().catch(console.error);
