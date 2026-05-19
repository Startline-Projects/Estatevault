import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

import { INHOUSE_ATTORNEY_EMAIL } from "../lib/attorney-review/routing";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("email", INHOUSE_ATTORNEY_EMAIL)
    .single();

  if (profErr || !profile) {
    console.error(`No profile found for ${INHOUSE_ATTORNEY_EMAIL}`);
    process.exit(1);
  }

  const { data: updated, error } = await supabase
    .from("attorney_reviews")
    .update({ attorney_id: profile.id })
    .in("status", ["pending", "in_review"])
    .select("id");

  if (error) {
    console.error("Update failed:", error.message);
    process.exit(1);
  }

  console.log(`Reassigned ${updated?.length ?? 0} review(s) to ${profile.full_name} <${profile.email}>`);
}

main().catch((e) => { console.error(e); process.exit(1); });
