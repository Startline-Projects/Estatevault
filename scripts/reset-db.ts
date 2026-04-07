/**
 * Wipes all data and creates a fresh admin account.
 *
 * Usage:
 *   npx tsx scripts/reset-db.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

const ADMIN_EMAIL = "admin@estatevault.us";
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

  console.log("Starting database reset...\n");

  // 1. Delete all auth users
  console.log("Deleting auth users...");
  let page = 1;
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !users || users.length === 0) break;
    for (const u of users) {
      await supabase.auth.admin.deleteUser(u.id);
    }
    if (users.length < 100) break;
    page++;
  }
  console.log("  Auth users deleted.");

  // 2. Truncate tables in dependency order (children before parents)
  const tables = [
    "audit_log",
    "payouts",
    "attorney_reviews",
    "farewell_verification_requests",
    "vault_items",
    "vault_trustees",
    "documents",
    "quiz_sessions",
    "orders",
    "clients",
    "partners",
    "profiles",
    "app_settings",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.warn(`  Warning: could not clear "${table}": ${error.message}`);
    } else {
      console.log(`  Cleared: ${table}`);
    }
  }

  // 3. Create fresh admin
  console.log("\nCreating admin account...");
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

  console.log("\nDatabase reset complete!");
  console.log("─────────────────────────────");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${tempPassword}`);
  console.log("─────────────────────────────");
  console.log("  Change the password after first login.");
}

main().catch(console.error);
