import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { uploadDocument } from "@/lib/documents/storage";
import { sendDocumentEmail, sendAttorneyReviewPendingEmail, buildAssetChecklist } from "@/lib/email";
import { wantsNotification } from "@/lib/notifications/prefs";
import { requireAuth } from "@/lib/api/auth";

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

export async function GET(request: NextRequest) {
  const auth = await requireAuth(["admin"], request);
  if ("error" in auth) return auth.error;

  const log: string[] = [];
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return NextResponse.json({ error: "Add ?order_id=XXX to the URL", log });
    }

    const supabase = createAdminClient();
    log.push("1. Connected to Supabase");

    // Find the order, include attorney_review_requested
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, client_id, product_type, status, order_type, quiz_session_id, intake_data, attorney_review_requested")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      log.push(`2. Order NOT found: ${orderErr?.message || "no data"}`);
      return NextResponse.json({ error: "Order not found", log });
    }

    const isAttorneyReview = order.attorney_review_requested === true;
    log.push(`2. Order found: type=${order.product_type}, status=${order.status}, attorney_review=${isAttorneyReview}, client_id=${order.client_id}`);

    // Get quiz answers, prefer intake_data, then quiz_session_id, then client_id
    let quizAnswers: Record<string, unknown> = {};
    if (order.intake_data && typeof order.intake_data === "object") {
      quizAnswers = order.intake_data as Record<string, unknown>;
      log.push("3. Quiz answers found via order.intake_data");
    } else if (order.quiz_session_id) {
      const { data, error } = await supabase.from("quiz_sessions").select("answers").eq("id", order.quiz_session_id).single();
      if (data) { quizAnswers = (data.answers as Record<string, unknown>) || {}; log.push("3. Quiz answers found via quiz_session_id"); }
      else log.push(`3. Quiz session NOT found: ${error?.message}`);
    } else if (order.client_id) {
      const { data } = await supabase.from("quiz_sessions").select("answers").eq("client_id", order.client_id).order("created_at", { ascending: false }).limit(1).single();
      if (data) { quizAnswers = (data.answers as Record<string, unknown>) || {}; log.push("3. Quiz answers found via client_id"); }
      else log.push("3. No quiz session found for client_id");
    } else {
      log.push("3. No intake_data, no quiz_session_id, and no client_id");
      return NextResponse.json({ error: "No intake answers available", log });
    }

    log.push(`4. Intake has ${Object.keys(quizAnswers).length} fields. firstName=${quizAnswers.firstName}, lastName=${quizAnswers.lastName}`);

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
      log.push("5. ANTHROPIC_API_KEY is missing!");
      return NextResponse.json({ error: "Anthropic API key not configured", log });
    }
    log.push("5. ANTHROPIC_API_KEY is set");

    const isTestOrder = order.order_type === "test";
    const documentTypes = order.product_type === "trust"
      ? ["trust", "pour_over_will", "poa", "healthcare_directive"]
      : ["will", "poa", "healthcare_directive"];

    log.push(`6. Will generate ${documentTypes.length} documents: ${documentTypes.join(", ")}`);

    // Resolve partner branding for the PDF cover/header
    let partnerName: string | undefined;
    let partnerLogoUrl: string | null = null;
    if (order.client_id) {
      const { data: clientRow } = await supabase
        .from("clients")
        .select("partner_id")
        .eq("id", order.client_id)
        .maybeSingle();
      if (clientRow?.partner_id) {
        const { data: partner } = await supabase
          .from("partners")
          .select("company_name, logo_url")
          .eq("id", clientRow.partner_id)
          .maybeSingle();
        partnerName = partner?.company_name || undefined;
        partnerLogoUrl = partner?.logo_url || null;
      }
    }

    // Mark order as generating so client dashboard shows spinner
    await supabase.from("orders").update({ status: "generating" }).eq("id", orderId);

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
        log.push(`   ${docType}: generated ${documentText.length} chars`);

        const clientFullName = String(quizAnswers.firstName || "") + " " + String(quizAnswers.lastName || "");
        const { generatePDF } = await import("@/lib/documents/generate-pdf");
        const pdfBuffer = await generatePDF(
          documentText, docType,
          clientFullName,
          partnerName, undefined, String(quizAnswers.city || ""),
          partnerLogoUrl
        );

        // Editable DOCX for attorney review (non-fatal if it fails).
        let docxBuffer: Buffer | undefined;
        if (isAttorneyReview) {
          try {
            const { generateDOCX } = await import("@/lib/documents/generate-docx");
            docxBuffer = await generateDOCX(documentText, docType, clientFullName, partnerName, partnerLogoUrl);
          } catch (e) {
            log.push(`   ${docType}: DOCX generation failed (non-fatal): ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        const storageClientId = isTestOrder ? "test" : (order.client_id || "unknown");
        const path = await uploadDocument(storageClientId, order.id, docType, pdfBuffer, docxBuffer);
        // uploadDocument sets doc status to "generated", we will update below
        log.push(`   ${docType}: uploaded to ${path}`);
        results.push({ docType, success: true, path });
      } catch (docError) {
        const msg = docError instanceof Error ? docError.message : String(docError);
        log.push(`   ${docType}: FAILED, ${msg}`);
        results.push({ docType, success: false, error: msg });
      }
    }

    // Update order and document statuses based on attorney review
    if (isAttorneyReview) {
      // Order goes to "review", attorney must approve before client can download
      await supabase.from("orders").update({ status: "review" }).eq("id", orderId);
      await supabase.from("documents").update({ status: "review" }).eq("order_id", orderId);
      log.push("8. Order and documents set to 'review' (attorney review required)");
    } else {
      // No attorney review, deliver immediately
      await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId);
      await supabase.from("documents").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("order_id", orderId);
      log.push("8. Order and documents set to 'delivered'");
    }

    // Notify client via email
    if (!isTestOrder && order.client_id) {
      try {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("profile_id, partner_id")
          .eq("id", order.client_id)
          .maybeSingle();
        const profileId = clientRow?.profile_id;
        let clientEmail: string | null = null;
        if (profileId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", profileId)
            .maybeSingle();
          clientEmail = profile?.email || null;
        }
        const productType = order.product_type as "will" | "trust";
        if (clientEmail && (productType === "will" || productType === "trust")) {
          if (isAttorneyReview) {
            await sendAttorneyReviewPendingEmail({
              to: clientEmail,
              productType,
              partnerId: clientRow?.partner_id || null,
            });
            log.push(`9. Sent attorney-review-pending email to ${clientEmail}`);
            await supabase.from("audit_log").insert({
              action: "email.attorney_review_pending",
              resource_type: "order",
              resource_id: orderId,
            });
          } else if (!(await wantsNotification(supabase, profileId, "documents_delivered"))) {
            log.push(`9. Skipped document email (client opted out)`);
          } else {
            const { origin } = new URL(request.url);
            const assetTypes = Array.isArray((quizAnswers as { assetTypes?: unknown }).assetTypes)
              ? ((quizAnswers as { assetTypes?: string[] }).assetTypes as string[])
              : [];
            await sendDocumentEmail({
              to: clientEmail,
              productType,
              loginLink: `${origin}/auth/login?email=${encodeURIComponent(clientEmail)}`,
              assetChecklist: productType === "trust" ? buildAssetChecklist(assetTypes) : undefined,
              partnerId: clientRow?.partner_id || null,
            });
            log.push(`9. Sent document email to ${clientEmail}`);
            await supabase.from("audit_log").insert({
              action: "email.documents_delivered",
              resource_type: "order",
              resource_id: orderId,
            });
          }
        } else {
          log.push("9. Skipped email (no client email found)");
        }
      } catch (mailErr) {
        log.push(`9. Email send failed: ${mailErr instanceof Error ? mailErr.message : String(mailErr)}`);
      }
    }

    // E2EE Phase 12b: purge plaintext quiz answers once PDFs generated.
    if (order.quiz_session_id) {
      await supabase.from("quiz_sessions")
        .update({ answers: {}, answers_purged_at: new Date().toISOString() })
        .eq("id", order.quiz_session_id);
      log.push("9. Quiz answers purged (E2EE)");
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      attorney_review: isAttorneyReview,
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
