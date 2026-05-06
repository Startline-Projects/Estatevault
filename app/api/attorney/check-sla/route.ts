import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET() {
  const supabase = createAdminClient();

  // Find overdue reviews
  const { data: overdue } = await supabase
    .from("attorney_reviews")
    .select("id, order_id, attorney_id, sla_deadline")
    .in("status", ["pending", "in_review"])
    .lt("sla_deadline", new Date().toISOString());

  if (!overdue || overdue.length === 0) {
    return NextResponse.json({ message: "No overdue reviews" });
  }

  for (const review of overdue) {
    await supabase.from("audit_log").insert({
      action: "attorney_review.sla_overdue",
      resource_type: "attorney_review",
      resource_id: review.id,
      metadata: { order_id: review.order_id, sla_deadline: review.sla_deadline },
    });
  }

  return NextResponse.json({ overdue_count: overdue.length });
}
