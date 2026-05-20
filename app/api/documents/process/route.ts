export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { popNextJob, getJob, updateJob, ratelimit } from "@/lib/queue/document-queue";
import { uploadDocument } from "@/lib/documents/storage";
import { sendDocumentEmail, sendAttorneyReviewPendingEmail, buildAssetChecklist } from "@/lib/email";
import { wantsNotification } from "@/lib/notifications/prefs";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function notifyClientByEmail(
  supabase: SupabaseAdmin,
  orderId: string,
  clientId: string | null,
  productType: string,
  isAttorneyReview: boolean,
  intake: Record<string, unknown>,
  origin: string,
) {
  if (!clientId) return;
  if (productType !== "will" && productType !== "trust") return;
  try {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("profile_id, partner_id")
      .eq("id", clientId)
      .maybeSingle();
    const profileId = clientRow?.profile_id;
    if (!profileId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", profileId)
      .maybeSingle();
    const clientEmail = profile?.email;
    if (!clientEmail) return;

    const partnerId = clientRow?.partner_id || null;
    if (isAttorneyReview) {
      await sendAttorneyReviewPendingEmail({
        to: clientEmail,
        productType: productType as "will" | "trust",
        partnerId,
      });
    } else {
      if (!(await wantsNotification(supabase, profileId, "documents_delivered"))) return;
      const assetTypes = Array.isArray((intake as { assetTypes?: unknown }).assetTypes)
        ? ((intake as { assetTypes?: string[] }).assetTypes as string[])
        : [];
      await sendDocumentEmail({
        to: clientEmail,
        productType: productType as "will" | "trust",
        loginLink: `${origin}/auth/login?email=${encodeURIComponent(clientEmail)}`,
        assetChecklist: productType === "trust" ? buildAssetChecklist(assetTypes) : undefined,
        partnerId,
      });
    }
    await supabase.from("audit_log").insert({
      action: isAttorneyReview ? "email.attorney_review_pending" : "email.documents_delivered",
      resource_type: "order",
      resource_id: orderId,
    });
  } catch (mailErr) {
    console.error("notifyClientByEmail failed:", mailErr);
  }
}

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

export async function GET(request: Request) {
  try {
    // Try Redis queue first
    const jobId = await popNextJob();

    // If no queued jobs, check for unprocessed orders directly in Supabase
    const supabase = createAdminClient();

    if (!jobId) {
      // Fallback: find orders with status 'generating' OR 'review' that have pending/ungenerated documents
      const { data: generatingOrders } = await supabase
        .from("orders")
        .select("id, client_id, product_type, attorney_review_requested, order_type, quiz_session_id, intake_data")
        .eq("status", "generating")
        .limit(1);

      // Also check for attorney-review orders stuck in 'review' with pending documents
      let pendingOrders = generatingOrders;
      if (!pendingOrders || pendingOrders.length === 0) {
        const { data: reviewOrders } = await supabase
          .from("orders")
          .select("id, client_id, product_type, attorney_review_requested, order_type, quiz_session_id, intake_data")
          .eq("status", "review")
          .eq("attorney_review_requested", true)
          .limit(1);

        // Only process if documents are still pending (storage_path is null)
        if (reviewOrders && reviewOrders.length > 0) {
          const { data: pendingDocs } = await supabase
            .from("documents")
            .select("id")
            .eq("order_id", reviewOrders[0].id)
            .is("storage_path", null)
            .limit(1);
          if (pendingDocs && pendingDocs.length > 0) {
            pendingOrders = reviewOrders;
          }
        }
      }

      if (!pendingOrders || pendingOrders.length === 0) {
        return NextResponse.json({ message: "No jobs in queue and no pending orders" });
      }

      const order = pendingOrders[0];
      const isTestOrder = order.order_type === "test";

      // For test orders, prefer intake_data on the order; fallback to quiz_session_id or client_id
      let quizAnswers: Record<string, unknown> = {};
      if (order.intake_data && typeof order.intake_data === "object") {
        quizAnswers = order.intake_data as Record<string, unknown>;
      } else if (order.quiz_session_id) {
        const { data } = await supabase.from("quiz_sessions").select("answers").eq("id", order.quiz_session_id).single();
        if (data) quizAnswers = (data.answers as Record<string, unknown>) || {};
      } else if (order.client_id) {
        const { data } = await supabase.from("quiz_sessions").select("answers").eq("client_id", order.client_id).order("created_at", { ascending: false }).limit(1).single();
        if (data) quizAnswers = (data.answers as Record<string, unknown>) || {};
      }

      const documentTypes = order.product_type === "trust"
        ? ["trust", "pour_over_will", "poa", "healthcare_directive"]
        : ["will", "poa", "healthcare_directive"];

      console.log("Processing order directly:", order.id, "documents:", documentTypes);

      if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
        return NextResponse.json({ message: "Anthropic API key not configured" });
      }

      const intake = quizAnswers;

      // Resolve partner branding once
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

      for (const docType of documentTypes) {
        try {
          console.log("Generating document:", docType);
          const template = await getTemplate(docType);
          const userPrompt = template.buildPrompt(intake);

          // Trust documents are longer and need more tokens
          const maxTokens = docType === "trust" ? 16000 : 8000;

          const response = await claude.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: maxTokens,
            system: template.systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          });

          const documentText = response.content[0].type === "text" ? response.content[0].text : "";
          console.log("Document generated:", docType, "length:", documentText.length, "stop_reason:", response.stop_reason);

          const clientFullName = String(intake.firstName || "") + " " + String(intake.lastName || "");
          const { generatePDF } = await import("@/lib/documents/generate-pdf");
          const pdfBuffer = await generatePDF(
            documentText, docType,
            clientFullName,
            partnerName, undefined, String(intake.city || ""),
            partnerLogoUrl
          );

          // Editable DOCX for attorney review (non-fatal if it fails).
          let docxBuffer: Buffer | undefined;
          if (order.attorney_review_requested) {
            try {
              const { generateDOCX } = await import("@/lib/documents/generate-docx");
              docxBuffer = await generateDOCX(documentText, docType, clientFullName, partnerName);
            } catch (e) {
              console.error("DOCX generation failed (non-fatal):", docType, e);
            }
          }

          const storageClientId = isTestOrder ? "test" : order.client_id;
          await uploadDocument(storageClientId, order.id, docType, pdfBuffer, docxBuffer);
          console.log("Document uploaded:", docType, "test:", isTestOrder);
        } catch (docError) {
          console.error(`Error generating ${docType}:`, docError);
        }
      }

      // Update order status
      if (order.attorney_review_requested) {
        await supabase.from("orders").update({ status: "review" }).eq("id", order.id);
        await supabase.from("documents").update({ status: "review" }).eq("order_id", order.id);
      } else {
        await supabase.from("orders").update({ status: "delivered" }).eq("id", order.id);
        await supabase.from("documents").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("order_id", order.id);
      }

      // Notify client via email (delivered → docs ready; review → attorney pending notice)
      if (!isTestOrder) {
        const { origin } = new URL(request.url);
        await notifyClientByEmail(
          supabase,
          order.id,
          order.client_id,
          order.product_type,
          !!order.attorney_review_requested,
          intake,
          origin,
        );
      }

      // E2EE Phase 12b: purge plaintext quiz answers once PDFs are generated.
      // PDFs are sealed to user pubkey (Phase 12); server no longer needs intake.
      if (order.quiz_session_id) {
        await supabase.from("quiz_sessions")
          .update({ answers: {}, answers_purged_at: new Date().toISOString() })
          .eq("id", order.quiz_session_id);
      }

      return NextResponse.json({ message: "Order processed directly", order_id: order.id });
    }

    // Redis queue path
    const job = await getJob(jobId);
    if (!job) return NextResponse.json({ message: "Job not found" });

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
      return NextResponse.json({ message: "Anthropic API key not configured" });
    }

    await updateJob(jobId, { status: "processing", started_at: new Date().toISOString(), attempts: job.attempts + 1 });

    const intake = job.intake_answers;

    // Does this order want attorney review? Gates editable DOCX generation.
    let jobReviewRequested = false;
    if (job.order_id) {
      const { data: jobOrderFlag } = await supabase
        .from("orders").select("attorney_review_requested").eq("id", job.order_id).maybeSingle();
      jobReviewRequested = !!jobOrderFlag?.attorney_review_requested;
    }

    // Resolve partner branding once for this job
    let jobPartnerName: string | undefined;
    let jobPartnerLogoUrl: string | null = null;
    if (job.client_id) {
      const { data: clientRow } = await supabase
        .from("clients").select("partner_id").eq("id", job.client_id).maybeSingle();
      if (clientRow?.partner_id) {
        const { data: partner } = await supabase
          .from("partners").select("company_name, logo_url").eq("id", clientRow.partner_id).maybeSingle();
        jobPartnerName = partner?.company_name || undefined;
        jobPartnerLogoUrl = partner?.logo_url || null;
      }
    }

    for (const docType of job.document_types) {
      try {
        // Rate limit check
        if (ratelimit) {
          const { success } = await ratelimit.limit("document_generation");
          if (!success) {
            // Re-queue with delay
            await updateJob(jobId, { status: "queued", error: "Rate limited, re-queued" });
            return NextResponse.json({ message: "Rate limited, re-queued" });
          }
        }

        const template = await getTemplate(docType);
        const userPrompt = template.buildPrompt(intake);

        const maxTokens = docType === "trust" ? 16000 : 8000;
        const response = await claude.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          system: template.systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        const documentText = response.content[0].type === "text" ? response.content[0].text : "";

        // Generate PDF
        const jobClientFullName = String(intake.firstName || "") + " " + String(intake.lastName || "");
        const { generatePDF } = await import("@/lib/documents/generate-pdf");
        const pdfBuffer = await generatePDF(
          documentText, docType,
          jobClientFullName,
          jobPartnerName, undefined, undefined, jobPartnerLogoUrl
        );

        // Editable DOCX for attorney review (non-fatal if it fails).
        let jobDocxBuffer: Buffer | undefined;
        if (jobReviewRequested) {
          try {
            const { generateDOCX } = await import("@/lib/documents/generate-docx");
            jobDocxBuffer = await generateDOCX(documentText, docType, jobClientFullName, jobPartnerName);
          } catch (e) {
            console.error("DOCX generation failed (non-fatal):", docType, e);
          }
        }

        // Upload to storage
        await uploadDocument(job.client_id, job.order_id, docType, pdfBuffer, jobDocxBuffer);

        await supabase.from("audit_log").insert({ action: "document.generated", resource_type: "document", metadata: { order_id: job.order_id, document_type: docType } });
      } catch (docError) {
        console.error(`Error generating ${docType}:`, docError);
        // Continue with other documents
      }
    }

    // E2EE Phase 12b: purge plaintext quiz answers once PDFs generated.
    if (job.order_id) {
      const { data: jobOrder } = await supabase
        .from("orders")
        .select("quiz_session_id")
        .eq("id", job.order_id)
        .maybeSingle();
      if (jobOrder?.quiz_session_id) {
        await supabase.from("quiz_sessions")
          .update({ answers: {}, answers_purged_at: new Date().toISOString() })
          .eq("id", jobOrder.quiz_session_id);
      }
    }

    // Mark job complete
    await updateJob(jobId, { status: "complete", completed_at: new Date().toISOString() });

    // Update order status
    if (job.attorney_review) {
      await supabase.from("orders").update({ status: "review" }).eq("id", job.order_id);
      await supabase.from("documents").update({ status: "review" }).eq("order_id", job.order_id);
    } else {
      await supabase.from("orders").update({ status: "delivered" }).eq("id", job.order_id);

      // Update document statuses to delivered
      await supabase.from("documents").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("order_id", job.order_id);
    }

    // Notify client via email
    {
      const { data: jobOrderInfo } = await supabase
        .from("orders")
        .select("product_type, order_type")
        .eq("id", job.order_id)
        .maybeSingle();
      if (jobOrderInfo && jobOrderInfo.order_type !== "test") {
        const { origin } = new URL(request.url);
        await notifyClientByEmail(
          supabase,
          job.order_id,
          job.client_id,
          jobOrderInfo.product_type,
          !!job.attorney_review,
          intake as Record<string, unknown>,
          origin,
        );
      }
    }

    // Auto-populate vault
    const docTypes = job.document_types;
    for (const dt of docTypes) {
      const row = {
        client_id: job.client_id,
        category: "estate_document",
        label: `${dt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}, ${new Date().toLocaleDateString()}`,
        data: { document_type: dt, order_id: job.order_id, generated_date: new Date().toISOString(), is_auto_generated: true },
      };
      const r = await supabase.from("vault_items").upsert({ ...row, auto_generated: true }, { onConflict: "id" });
      if (r.error) {
        // Fallback for envs missing 20260518_vault_auto_generated.sql
        await supabase.from("vault_items").upsert(row, { onConflict: "id" });
      }
    }

    await supabase.from("audit_log").insert({ action: "documents.generation_complete", resource_type: "order", resource_id: job.order_id, metadata: { job_id: jobId, documents: docTypes } });

    return NextResponse.json({ message: "Job processed", job_id: jobId });
  } catch (error) {
    console.error("Document processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
