import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: orders } = await supabase
    .from("orders")
    .select("id, product_type, status, attorney_review_requested, created_at, intake_data, quiz_session_id, client_id")
    .order("created_at", { ascending: false })
    .limit(3);

  for (const o of orders || []) {
    console.log("\n────────────────────────────────────────");
    console.log("ORDER", o.id);
    console.log("  product_type:", o.product_type, "| status:", o.status, "| attorney_review:", o.attorney_review_requested);
    console.log("  created_at:", o.created_at, "| client_id:", o.client_id);
    console.log("  intake_data keys:", o.intake_data ? Object.keys(o.intake_data as object).length : 0);

    const { data: docs } = await supabase
      .from("documents")
      .select("document_type, status, storage_path, generated_at, delivered_at")
      .eq("order_id", o.id);
    console.log("  docs:");
    (docs || []).forEach((d) => {
      console.log(`    - ${d.document_type}: status=${d.status} | storage_path=${d.storage_path ? "YES" : "NULL"} | generated_at=${d.generated_at || "-"}`);
    });

    const { data: rev } = await supabase
      .from("attorney_reviews")
      .select("id, attorney_id, status, reviewer_type")
      .eq("order_id", o.id)
      .maybeSingle();
    if (rev) console.log("  attorney_review:", rev);

    if (o.quiz_session_id) {
      const { data: qs } = await supabase
        .from("quiz_sessions")
        .select("answers_purged_at, answers")
        .eq("id", o.quiz_session_id)
        .maybeSingle();
      console.log("  quiz purged_at:", qs?.answers_purged_at || "no", "| answers keys:", qs?.answers ? Object.keys(qs.answers as object).length : 0);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
