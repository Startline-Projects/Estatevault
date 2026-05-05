/**
 * Seeds test users + role rows into Supabase. Idempotent.
 *
 * Usage: TEST_MODE=1 npx tsx scripts/test-db-seed.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { TEST_USERS } from "../tests/fixtures/users";

dotenv.config({ path: ".env.test" });
dotenv.config({ path: ".env.local", override: process.env.TEST_ALLOW_SHARED_DB === "1" });

async function main() {
  if (process.env.TEST_MODE !== "1") {
    console.error("Refusing to run: set TEST_MODE=1");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Auth users
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const byEmail = new Map((list?.users ?? []).map((u) => [u.email!, u]));

  const userIds: Record<string, string> = {};
  for (const [key, u] of Object.entries(TEST_USERS)) {
    let user = byEmail.get(u.email);
    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.name },
      });
      if (error || !data.user) { console.error(`  fail ${u.email}: ${error?.message}`); continue; }
      user = data.user;
      console.log(`  added auth ${u.email}`);
    } else {
      console.log(`  exists auth ${u.email}`);
    }
    userIds[key] = user.id;
  }

  // 2. profiles — set correct user_type per fixture (trigger inserts default 'client')
  const typeMap: Record<string, string> = {
    admin: "admin",
    partnerBasic: "partner",
    partnerEnterprise: "partner",
    client: "client",
    attorney: "review_attorney",
    salesRep: "sales_rep",
  };
  for (const [key, id] of Object.entries(userIds)) {
    const u = (TEST_USERS as any)[key];
    const { error } = await supabase
      .from("profiles")
      .upsert({ id, email: u.email, full_name: u.name, user_type: typeMap[key] }, { onConflict: "id" });
    if (error) console.error(`  profile fail ${u.email}: ${error.message}`);
    else console.log(`  profile ${u.email} → ${typeMap[key]}`);
  }

  // 3. partners rows for partner users
  for (const tier of ["partnerBasic", "partnerEnterprise"] as const) {
    const id = userIds[tier];
    if (!id) continue;
    const u = TEST_USERS[tier];
    const { data: existing } = await supabase
      .from("partners").select("id").eq("profile_id", id).maybeSingle();
    if (existing) { console.log(`  partner exists ${u.email}`); continue; }
    const { error } = await supabase.from("partners").insert({
      profile_id: id,
      company_name: u.name,
      tier: tier === "partnerEnterprise" ? "enterprise" : "standard",
      status: "active",
      subdomain: u.slug,
      onboarding_completed: true,
      annual_fee_paid: true,
      annual_fee_paid_at: new Date().toISOString(),
    });
    if (error) console.error(`  partner fail ${u.email}: ${error.message}`);
    else console.log(`  partner inserted ${u.email}`);
  }

  // 4. clients row for client user
  if (userIds.client) {
    const { data: existing } = await supabase
      .from("clients").select("id").eq("profile_id", userIds.client).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from("clients").insert({
        profile_id: userIds.client,
        source: "direct",
      });
      if (error) console.error(`  client fail: ${error.message}`);
      else console.log(`  client inserted`);
    } else {
      console.log(`  client exists`);
    }
  }

  console.log("Seed done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
