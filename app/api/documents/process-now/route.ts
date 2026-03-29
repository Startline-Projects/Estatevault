import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { uploadDocument } from "@/lib/documents/storage";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
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

// TEMPORARY DEBUG ENDPOINT — remove after testing
export async function GET(request: Request) {
  const log: string[] = [];
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return NextResponse.json({ error: "Add ?order_id=XXX to the URL", log });
    }

    const supabase = createAdminClient();
    log.push("1. Connected to Supabase");

    // Find the order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, client_id, product_type, status, order_type, quiz_session_id")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      log.push(`2. Order NOT found: ${orderErr?.message || "no data"}`);
      return NextResponse.json({ error: "Order not found", log });
    }

    log.push(`2. Order found: type=${order.product_type}, status=${order.status}, order_type=${order.order_type}, client_id=${order.client_id}, quiz_session_id=${order.quiz_session_id}`);

    // Get quiz answers
    let quizAnswers: Record<string, unknown> = {};
    if (order.quiz_session_id) {
      const { data, error } = await supabase.from("quiz_sessions").select("answers").eq("id", order.quiz_session_id).single();
      if (data) { quizAnswers = (data.answers as Record<string, unknown>) || {}; log.push("3. Quiz answers found via quiz_session_id"); }
      else log.push(`3. Quiz session NOT found: ${error?.message}`);
    } else if (order.client_id) {
      const { data } = await supabase.from("quiz_sessions").select("answers").eq("client_id", order.client_id).order("created_at", { ascending: false }).limit(1).single();
      if (data) { quizAnswers = (data.answers as Record<string, unknown>) || {}; log.push("3. Quiz answers found via client_id"); }
      else log.push("3. No quiz session found for client_id");
    } else {
      log.push("3. No quiz_session_id and no client_id — cannot find intake answers");
      return NextResponse.json({ error: "No intake answers available", log });
    }

    log.push(`4. Intake has ${Object.keys(quizAnswers).length} fields. firstName=${quizAnswers.firstName}, lastName=${quizAnswers.lastName}`);

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
      log.push("5. ANTHROPIC_API_KEY is missing or placeholder!");
      return NextResponse.json({ error: "Anthropic API key not configured", log });
    }
    log.push("5. ANTHROPIC_API_KEY is set");

    const isTestOrder = order.order_type === "test";
    const documentTypes = order.product_type === "trust"
      ? ["trust", "pour_over_will", "poa", "healthcare_directive"]
      : ["will", "poa", "healthcare_directive"];

    log.push(`6. Will generate ${documentTypes.length} documents: ${documentTypes.join(", ")}`);

    const results: Array<{ docType: string; success: boolean; path?: string; error?: string }> = [];

    for (const docType of documentTypes) {
      try {
        log.push(`7. Generating ${docType}...`);
        const template = await getTemplate(docType);
        const userPrompt = template.buildPrompt(quizAnswers);
        const maxTokens = docType === "trust" ? 16000 : 8000;

        const response = await claude.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          system: template.systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        const documentText = response.content[0].type === "text" ? response.content[0].text : "";
        log.push(`   ${docType}: generated ${documentText.length} chars, stop_reason=${response.stop_reason}`);

        const { generatePDF } = await import("@/lib/documents/generate-pdf");
        const pdfBuffer = await generatePDF(
          documentText, docType,
          String(quizAnswers.firstName || "") + " " + String(quizAnswers.lastName || ""),
          undefined, undefined, String(quizAnswers.city || "")
        );

        const storageClientId = isTestOrder ? "test" : (order.client_id || "unknown");
        const path = await uploadDocument(storageClientId, order.id, docType, pdfBuffer);
        log.push(`   ${docType}: uploaded to ${path}`);
        results.push({ docType, success: true, path });
      } catch (docError) {
        const msg = docError instanceof Error ? docError.message : String(docError);
        log.push(`   ${docType}: FAILED — ${msg}`);
        results.push({ docType, success: false, error: msg });
      }
    }

    // Update order status
    await supabase.from("orders").update({ status: "delivered" }).eq("id", order.id);
    log.push("8. Order status updated to delivered");

    return NextResponse.json({
      success: true,
      order_id: orderId,
      documents_generated: results.filter((r) => r.success).length,
      documents_failed: results.filter((r) => !r.success).length,
      results,
      log,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.push(`FATAL ERROR: ${msg}`);
    return NextResponse.json({ error: msg, log }, { status: 500 });
  }
}
