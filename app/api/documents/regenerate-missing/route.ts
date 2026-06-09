export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { type NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient, requireAuth } from "@/lib/api/auth";
import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { uploadDocument } from "@/lib/documents/storage";
import { getTemplate } from "@/lib/documents/templates/resolve";
import { tryTemplateRender } from "@/lib/documents/generate-from-template";

export const GET = withRoute(async (request: NextRequest) => {
  const auth = await requireAuth(["admin"], request);
  if ("error" in auth) return auth.error;

  const log: string[] = [];
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");
    if (!orderId) {
      return fail("Add ?order_id=XXX", 400, { log });
    }

    const supabase = createAdminClient();

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, client_id, product_type, status, order_type, quiz_session_id, intake_data, attorney_review_requested")
      .eq("id", orderId)
      .single();
    if (orderErr || !order) {
      return fail("Order not found", 404, { log });
    }
    log.push(`order ${order.id} status=${order.status} attorney_review=${order.attorney_review_requested}`);

    const { data: missingDocs } = await supabase
      .from("documents")
      .select("id, document_type")
      .eq("order_id", orderId)
      .is("storage_path", null);

    if (!missingDocs || missingDocs.length === 0) {
      return ok({ message: "No missing documents", log });
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
      return fail("No intake answers available (quiz purged and order.intake_data empty)", 400, { log });
    }

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
      return fail("ANTHROPIC_API_KEY missing", 500, { log });
    }

    const isTestOrder = order.order_type === "test";
    const isAttorneyReview = order.attorney_review_requested === true;
    const results: Array<{ docType: string; success: boolean; path?: string; error?: string }> = [];

    // Partner branding
    let partnerName: string | undefined;
    let partnerLogoUrl: string | null = null;
    if (order.client_id) {
      const { data: clientRow } = await supabase
        .from("clients").select("partner_id").eq("id", order.client_id).maybeSingle();
      if (clientRow?.partner_id) {
        const { data: partner } = await supabase
          .from("partners").select("company_name, logo_url").eq("id", clientRow.partner_id).maybeSingle();
        partnerName = partner?.company_name || undefined;
        partnerLogoUrl = partner?.logo_url || null;
      }
    }

    for (const doc of missingDocs) {
      const docType = doc.document_type;
      try {
        const clientFullName = String(intake.firstName || intake.first_name || "") + " " + String(intake.lastName || intake.last_name || "");
        let documentText: string;
        let pdfBuffer: Buffer;

        const templateResult = await tryTemplateRender(docType, intake, partnerName, partnerLogoUrl, clientFullName);
        if (templateResult) {
          pdfBuffer = templateResult.pdfBuffer;
          documentText = templateResult.documentText;
          log.push(`${docType}: template-rendered ${documentText.length} chars`);
        } else {
          const template = await getTemplate(docType);
          const userPrompt = template.buildPrompt(intake);
          const maxTokens = docType === "trust" ? 16000 : 8000;

          const response = await claude.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: maxTokens,
            system: template.systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          });

          documentText = response.content[0]?.type === "text" ? response.content[0].text : "";
          if (!documentText) throw new Error(`empty response, stop_reason=${response.stop_reason}`);
          log.push(`${docType}: ${documentText.length} chars, stop=${response.stop_reason}`);

          const { generatePDF } = await import("@/lib/documents/generate-pdf");
          pdfBuffer = await generatePDF(
            documentText,
            docType,
            clientFullName,
            partnerName,
            undefined,
            String(intake.city || ""),
            partnerLogoUrl
          );
        }

        let docxBuffer: Buffer | undefined;
        if (isAttorneyReview) {
          try {
            const { generateDOCX } = await import("@/lib/documents/generate-docx");
            docxBuffer = await generateDOCX(documentText, docType, clientFullName, partnerName, partnerLogoUrl);
          } catch (e) {
            log.push(`${docType}: DOCX generation failed (non-fatal): ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        const storageClientId = isTestOrder ? "test" : (order.client_id || "unknown");
        const path = await uploadDocument(storageClientId, order.id, docType, pdfBuffer, docxBuffer);

        // Restore status to match siblings
        const targetStatus = isAttorneyReview && order.status === "review" ? "review" : "delivered";
        const updates = targetStatus === "delivered"
          ? { status: targetStatus, delivered_at: new Date().toISOString() }
          : { status: targetStatus };
        await supabase.from("documents").update(updates).eq("id", doc.id);

        log.push(`${docType}: uploaded to ${path}`);
        results.push({ docType, success: true, path });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.push(`${docType}: FAILED, ${msg}`);
        results.push({ docType, success: false, error: msg });
      }
    }

    return ok({
      order_id: orderId,
      regenerated: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
      log,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.push(`FATAL: ${msg}`);
    return fail(msg, 500, { log });
  }
});
