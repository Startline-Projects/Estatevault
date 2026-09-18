/**
 * Creates (or resets) the review-attorney account the webhook routes paid
 * reviews to — the address in lib/config/contacts.ts.
 *
 * Usage:
 *   npx tsx scripts/create-review-attorney.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

import { REVIEW_ATTORNEY_EMAIL } from "../lib/config/contacts";

// The account the webhook assigns paid reviews to. One source of truth: change
// the address in lib/config/contacts.ts, not here.
const ATTORNEY_EMAIL = REVIEW_ATTORNEY_EMAIL;
const ATTORNEY_NAME = "Review Attorney";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tempPassword = "EV-Attorney-" + Math.random().toString(36).slice(2, 10);

  // Check if already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", ATTORNEY_EMAIL)
    .single();

  let userId: string;

  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, { password: tempPassword });
    console.log("Existing attorney found, password reset.");
  } else {
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: ATTORNEY_EMAIL,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: ATTORNEY_NAME, user_type: "review_attorney" },
    });

    if (error || !newUser.user) {
      console.error("Failed to create user:", error?.message);
      process.exit(1);
    }
    userId = newUser.user.id;
  }

  // Upsert profile with review_attorney type.
  //
  // No bar number, bar_verified or is_payroll here. This script used to stamp one
  // specific attorney's bar number on whatever account it created — and the
  // account it creates is now REVIEW_ATTORNEY_EMAIL, which during the pilot is a
  // relay inbox, not an attorney. Recording a bar-verified attorney under that
  // address would be false. Attorney credentials belong on the reviewing
  // attorney's own account (see supabase/migrations/20260401_001).
  await supabase.from("profiles").upsert({
    id: userId,
    email: ATTORNEY_EMAIL,
    full_name: ATTORNEY_NAME,
    user_type: "review_attorney",
  });

  console.log("\nReview attorney account ready!");
  console.log("─────────────────────────────────");
  console.log(`  Email:    ${ATTORNEY_EMAIL}`);
  console.log(`  Password: ${tempPassword}`);
  console.log("─────────────────────────────────");
  console.log("  Login at: https://www.estatevault.us/auth/login");
  console.log("  Dashboard: https://www.estatevault.us/attorney");
}

main().catch(console.error);
