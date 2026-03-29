/**
 * One-time script to create the admin account.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

// Load .env.local manually via Node
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

const ADMIN_EMAIL = "ockmedk@gmail.com";
const ADMIN_NAME = "Admin";

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

  // Check if admin already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, user_type")
    .eq("email", ADMIN_EMAIL)
    .single();

  if (existingProfile) {
    if (existingProfile.user_type === "admin") {
      console.log(`Admin account already exists for ${ADMIN_EMAIL}`);
      process.exit(0);
    }

    // Update existing profile to admin
    await supabase
      .from("profiles")
      .update({ user_type: "admin" })
      .eq("id", existingProfile.id);

    console.log(`Updated ${ADMIN_EMAIL} to admin user_type`);
    process.exit(0);
  }

  // Create new admin user
  const tempPassword = "EV-Admin-" + Math.random().toString(36).slice(2, 10);

  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME, user_type: "admin" },
  });

  if (createErr || !newUser.user) {
    console.error("Failed to create admin user:", createErr?.message);
    process.exit(1);
  }

  await supabase.from("profiles").upsert({
    id: newUser.user.id,
    email: ADMIN_EMAIL,
    full_name: ADMIN_NAME,
    user_type: "admin",
  });

  console.log("Admin account created successfully!");
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log(`  Password: ${tempPassword}`);
  console.log("  Please change the password after first login.");
}

main().catch(console.error);
