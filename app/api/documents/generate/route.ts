import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { addJob, type DocumentJob } from "@/lib/queue/document-queue";
import { randomUUID } from "crypto";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function POST(request: Request) {
  try {
    const { order_id } = await request.json();
    if (!order_id) return NextResponse.json({ error: "Missing order_id" }, { status: 400 });

    const supabase = createAdminClient();

    const { data: order } = await supabase.from("orders").select("*, clients(id, partner_id)").eq("id", order_id).single();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Get intake answers
    const { data: quiz } = await supabase.from("quiz_sessions").select("answers").eq("client_id", order.client_id).order("created_at", { ascending: false }).limit(1).single();

    const documentTypes = order.product_type === "trust"
      ? ["trust", "pour_over_will", "poa", "healthcare_directive"]
      : ["will", "poa", "healthcare_directive"];

    const job: DocumentJob = {
      job_id: randomUUID(),
      order_id,
      client_id: order.client_id,
      document_types: documentTypes,
      intake_answers: (quiz?.answers as Record<string, unknown>) || {},
      product_type: order.product_type,
      partner_id: order.partner_id || undefined,
      attorney_review: order.attorney_review_requested || false,
      status: "queued",
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      attempts: 0,
      error: null,
    };

    await addJob(job);

    // Update order status
    await supabase.from("orders").update({ status: "generating" }).eq("id", order_id);

    await supabase.from("audit_log").insert({ action: "documents.generation_queued", resource_type: "order", resource_id: order_id, metadata: { job_id: job.job_id, document_types: documentTypes } });

    return NextResponse.json({ job_id: job.job_id });
  } catch (error) {
    console.error("Document generation queue error:", error);
    return NextResponse.json({ error: "Failed to queue document generation" }, { status: 500 });
  }
}
