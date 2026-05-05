/**
 * Wipes test users + dependent data from the test Supabase project.
 *
 * SAFETY: refuses to run unless TEST_MODE=1 AND NEXT_PUBLIC_SUPABASE_URL contains
 * "test" OR matches TEST_SUPABASE_URL. Prevents accidental prod wipe.
 *
 * Usage: TEST_MODE=1 npx tsx scripts/test-db-reset.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { TEST_USERS } from "../tests/fixtures/users";

// Prefer .env.test, fall back to .env.local for shared-DB mode
dotenv.config({ path: ".env.test" });
dotenv.config({ path: ".env.local", override: process.env.TEST_ALLOW_SHARED_DB === "1" });

async function main() {
  if (process.env.TEST_MODE !== "1") {
    console.error("Refusing to run: set TEST_MODE=1");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.test");
    process.exit(1);
  }
  const expected = process.env.TEST_SUPABASE_URL;
  const sharedOk = process.env.TEST_ALLOW_SHARED_DB === "1";
  if (!url.includes("test") && url !== expected && !sharedOk) {
    console.error(`Refusing: ${url} does not look like test project.`);
    console.error(`Set TEST_SUPABASE_URL to whitelist, or TEST_ALLOW_SHARED_DB=1 to share with prod/dev (only @estatevault.test users will be touched).`);
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const emails = Object.values(TEST_USERS).map((u) => u.email);
  // Hard guard: every email must end with .test domain
  for (const e of emails) {
    if (!e.endsWith("@estatevault.test")) {
      console.error(`Refusing: fixture email ${e} not on @estatevault.test domain`);
      process.exit(1);
    }
  }
  console.log(`Deleting ${emails.length} test users...`);

  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  for (const user of list?.users ?? []) {
    if (emails.includes(user.email ?? "")) {
      await supabase.auth.admin.deleteUser(user.id);
      console.log(`  deleted ${user.email}`);
    }
  }
  console.log("Reset done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
