/**
 * Create sales admin (sales_rep) account.
 * Usage: npx tsx scripts/create-sales-admin.ts
 */
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

const EMAIL = "salesadmin@estatevault.us";
const NAME = "Sales Admin";
const PASSWORD = "SalesAdmin#2026";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing env vars in .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, user_type")
    .eq("email", EMAIL)
    .maybeSingle();

  let userId = existing?.id as string | undefined;

  if (!userId) {
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: NAME, user_type: "sales_rep" },
    });
    if (error || !newUser.user) {
      console.error("Create failed:", error?.message);
      process.exit(1);
    }
    userId = newUser.user.id;
  } else {
    // reset password to known value
    await supabase.auth.admin.updateUserById(userId, { password: PASSWORD });
  }

  await supabase.from("profiles").upsert({
    id: userId,
    email: EMAIL,
    full_name: NAME,
    user_type: "sales_rep",
    commission_rate: 0.10,
  });

  console.log("Sales admin ready:");
  console.log(`  Email: ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Login: /auth/login then visit /pro/sales`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
