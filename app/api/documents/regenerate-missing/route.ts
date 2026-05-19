export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { uploadDocument } from "@/lib/documents/storage";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

async function getTemplate(docType: string) {
  switch (docType) {
    case "will": {
      const { willSystemPrompt, buildWillPrompt } = await import("@/lib/documents/templates/michigan-will");
      return { systemPrompt: willSystemPrompt, buildPrompt: buildWillPrompt };
    }
    case "poa": {
      const { poaSystemPrompt, buildPOAPrompt } = await import("@/lib/documents/templates/michigan-poa");
      return { systemPrompt: poaSystemPrompt, buildPrompt: buildPOAPrompt };
    }
    case "healthcare_directive": {
      const { hcdSystemPrompt, buildHCDPrompt } = await import("@/lib/documents/templates/michigan-healthcare-directive");
      return { systemPrompt: hcdSystemPrompt, buildPrompt: buildHCDPrompt };
    }
    case "trust": {
      const { trustSystemPrompt, buildTrustPrompt } = await import("@/lib/documents/templates/michigan-revocable-trust");
      return { systemPrompt: trustSystemPrompt, buildPrompt: buildTrustPrompt };
    }
    case "pour_over_will": {
      const { pourOverWillSystemPrompt, buildPourOverWillPrompt } = await import("@/lib/documents/templates/michigan-pour-over-will");
      return { systemPrompt: pourOverWillSystemPrompt, buildPrompt: buildPourOverWillPrompt };
    }
    default:
      throw new Error(`Unknown document type: ${docType}`);
  }
}

export async function GET(request: Request) {
  const log: string[] = [];
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");
    if (!orderId) {
      return NextResponse.json({ error: "Add ?order_id=XXX", log }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, client_id, product_type, status, order_type, quiz_session_id, intake_data, attorney_review_requested")
      .eq("id", orderId)
      .single();
    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found", log }, { status: 404 });
    }
    log.push(`order ${order.id} status=${order.status} attorney_review=${order.attorney_review_requested}`);

    const { data: missingDocs } = await supabase
      .from("documents")
      .select("id, document_type")
      .eq("order_id", orderId)
      .is("storage_path", null);

    if (!missingDocs || missingDocs.length === 0) {
      return NextResponse.json({ message: "No missing documents", log });
    }
    log.push(`missing: ${missingDocs.map((d) => d.document_type).join(", ")}`);

    // Recover intake answers: prefer order.intake_data, fallback to quiz_sessions
    let intake: Record<string, unknown> = {};
    if (order.intake_data && typeof order.intake_data === "object" && Object.keys(order.intake_data).length > 0) {
      intake = order.intake_data as Record<string, unknown>;
      log.push("intake from order.intake_data");
    } else if (order.quiz_session_id) {
      const { data } = await supabase.from("quiz_sessions").select("answers").eq("id", order.quiz_session_id).maybeSingle();
      if (data?.answers && Object.keys(data.answers as object).length > 0) {
        intake = data.answers as Record<string, unknown>;
        log.push("intake from quiz_sessions");
      }
    }
    if (Object.keys(intake).length === 0) {
      return NextResponse.json({ error: "No intake answers available (quiz purged and order.intake_data empty)", log }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY missing", log }, { status: 500 });
    }

    const isTestOrder = order.order_type === "test";
    const isAttorneyReview = order.attorney_review_requested === true;
    const results: Array<{ docType: string; success: boolean; path?: string; error?: string }> = [];

    for (const doc of missingDocs) {
      const docType = doc.document_type;
      try {
        const template = await getTemplate(docType);
        const userPrompt = template.buildPrompt(intake);
        const maxTokens = docType === "trust" ? 16000 : 8000;

        const response = await claude.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          system: template.systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        const text = response.content[0]?.type === "text" ? response.content[0].text : "";
        if (!text) throw new Error(`empty response, stop_reason=${response.stop_reason}`);
        log.push(`${docType}: ${text.length} chars, stop=${response.stop_reason}`);

        const { generatePDF } = await import("@/lib/documents/generate-pdf");
        const pdfBuffer = await generatePDF(
          text,
          docType,
          String(intake.firstName || "") + " " + String(intake.lastName || ""),
          undefined,
          undefined,
          String(intake.city || "")
        );

        const storageClientId = isTestOrder ? "test" : (order.client_id || "unknown");
        const path = await uploadDocument(storageClientId, order.id, docType, pdfBuffer);

        // Restore status to match siblings
        const targetStatus = isAttorneyReview && order.status === "review" ? "review" : "delivered";
        const updates: Record<string, unknown> = { status: targetStatus };
        if (targetStatus === "delivered") updates.delivered_at = new Date().toISOString();
        await supabase.from("documents").update(updates).eq("id", doc.id);

        log.push(`${docType}: uploaded to ${path}`);
        results.push({ docType, success: true, path });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.push(`${docType}: FAILED, ${msg}`);
        results.push({ docType, success: false, error: msg });
      }
    }

    return NextResponse.json({
      order_id: orderId,
      regenerated: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
      log,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.push(`FATAL: ${msg}`);
    return NextResponse.json({ error: msg, log }, { status: 500 });
  }
}
