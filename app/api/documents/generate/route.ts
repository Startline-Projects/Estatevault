export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { addJob, type DocumentJob } from "@/lib/queue/document-queue";
import { randomUUID } from "crypto";
import { requireAuth, assertOrderAccess, rateLimit } from "@/lib/api/auth";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const { admin, profile } = auth;

    const { order_id } = await request.json();
    if (!order_id || typeof order_id !== "string") {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    const access = await assertOrderAccess(admin, order_id, profile);
    if ("error" in access) return access.error;

    if (!rateLimit(`gen:${profile.id}:${order_id}`, 3, 10 * 60_000)) {
      return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
    }

    const supabase = admin;

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
