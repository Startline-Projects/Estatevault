/**
 * Create a second dummy admin account.
 * Usage: npx tsx scripts/create-admin-dummy.ts
 */

import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

const ADMIN_EMAIL = "admin2@estatevault.us";
const ADMIN_NAME = "Admin Two";
const ADMIN_PASSWORD = "Admin2Pass!2026";

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

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, user_type")
    .eq("email", ADMIN_EMAIL)
    .single();

  if (existingProfile) {
    await supabase
      .from("profiles")
      .update({ user_type: "admin" })
      .eq("id", existingProfile.id);

    const { error: pwErr } = await supabase.auth.admin.updateUserById(existingProfile.id, {
      password: ADMIN_PASSWORD,
    });
    if (pwErr) console.error("Password update failed:", pwErr.message);

    console.log(`Existing user promoted/reset: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    process.exit(0);
  }

  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
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

  console.log("Dummy admin created!");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
}

main().catch(console.error);
