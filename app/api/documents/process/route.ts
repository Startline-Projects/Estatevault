export const dynamic = "force-dynamic";

import { type NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { popNextJob, getJob, updateJob, ratelimit } from "@/lib/queue/document-queue";
import { uploadDocument } from "@/lib/documents/storage";
import { sendDocumentEmail, sendAttorneyReviewPendingEmail, buildAssetChecklist } from "@/lib/email";
import { wantsNotification } from "@/lib/notifications/prefs";
import { getTemplate } from "@/lib/documents/templates/resolve";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import * as documentRepo from "@/lib/repos/server/documentRepo";

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
    await auditLogRepo.insertEntry(supabase, {
      action: isAttorneyReview ? "email.attorney_review_pending" : "email.documents_delivered",
      resource_type: "order",
      resource_id: orderId,
    });
  } catch (mailErr) {
    console.error("notifyClientByEmail failed:", mailErr);
  }
}

export const GET = withRoute(async (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("unauthorized", 401);
  }

  // Try Redis queue first
  const jobId = await popNextJob();
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
      return ok({ message: "No jobs in queue and no pending orders" });
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
      return ok({ message: "Anthropic API key not configured" });
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

    let failedCount = 0;
    for (const docType of documentTypes) {
      try {
        await documentRepo.updateStatusByType(supabase, order.id, docType, "generating");

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

        const clientFullName = String(intake.firstName || "") + " " + String(intake.lastName || "");
        const { generatePDF } = await import("@/lib/documents/generate-pdf");
        const pdfBuffer = await generatePDF(
          documentText, docType,
          clientFullName,
          partnerName, undefined, String(intake.city || ""),
          partnerLogoUrl
        );

        let docxBuffer: Buffer | undefined;
        if (order.attorney_review_requested) {
          try {
            const { generateDOCX } = await import("@/lib/documents/generate-docx");
            docxBuffer = await generateDOCX(documentText, docType, clientFullName, partnerName, partnerLogoUrl);
          } catch (e) {
            console.error("DOCX generation failed (non-fatal):", docType, e);
          }
        }

        const storageClientId = isTestOrder ? "test" : order.client_id;
        await uploadDocument(storageClientId, order.id, docType, pdfBuffer, docxBuffer);
        await documentRepo.updateStatusByType(supabase, order.id, docType, "generated");
      } catch (docError) {
        console.error(`Error generating ${docType}:`, docError);
        await documentRepo.updateStatusByType(supabase, order.id, docType, "failed", {
          error_message: docError instanceof Error ? docError.message : "Unknown error",
        });
        failedCount++;
      }
    }

    if (failedCount > 0) {
      console.error(`Order ${order.id}: ${failedCount}/${documentTypes.length} documents failed`);
      return ok({ message: "Partial failure", order_id: order.id, failed: failedCount });
    }

    const finalStatus = order.attorney_review_requested ? "review" : "delivered";
    await supabase.from("orders").update({ status: finalStatus }).eq("id", order.id);
    const docPatch: Record<string, unknown> = { status: finalStatus };
    if (!order.attorney_review_requested) docPatch.delivered_at = new Date().toISOString();
    await supabase.from("documents").update(docPatch).eq("order_id", order.id).eq("status", "generated");

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
    if (order.quiz_session_id) {
      await supabase.from("quiz_sessions")
        .update({ answers: {}, answers_purged_at: new Date().toISOString() })
        .eq("id", order.quiz_session_id);
    }

    return ok({ message: "Order processed directly", order_id: order.id });
  }

  // Redis queue path
  const job = await getJob(jobId);
  if (!job) return ok({ message: "Job not found" });

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
    return ok({ message: "Anthropic API key not configured" });
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

  let jobFailedCount = 0;
  for (const docType of job.document_types) {
    try {
      if (ratelimit) {
        const { success } = await ratelimit.limit("document_generation");
        if (!success) {
          await updateJob(jobId, { status: "queued", error: "Rate limited, re-queued" });
          return ok({ message: "Rate limited, re-queued" });
        }
      }

      await documentRepo.updateStatusByType(supabase, job.order_id, docType, "generating");

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

      const jobClientFullName = String(intake.firstName || "") + " " + String(intake.lastName || "");
      const { generatePDF } = await import("@/lib/documents/generate-pdf");
      const pdfBuffer = await generatePDF(
        documentText, docType,
        jobClientFullName,
        jobPartnerName, undefined, undefined, jobPartnerLogoUrl
      );

      let jobDocxBuffer: Buffer | undefined;
      if (jobReviewRequested) {
        try {
          const { generateDOCX } = await import("@/lib/documents/generate-docx");
          jobDocxBuffer = await generateDOCX(documentText, docType, jobClientFullName, jobPartnerName, jobPartnerLogoUrl);
        } catch (e) {
          console.error("DOCX generation failed (non-fatal):", docType, e);
        }
      }

      await uploadDocument(job.client_id, job.order_id, docType, pdfBuffer, jobDocxBuffer);
      await documentRepo.updateStatusByType(supabase, job.order_id, docType, "generated");

      await auditLogRepo.insertEntry(supabase, {
        action: "document.generated",
        resource_type: "document",
        metadata: { order_id: job.order_id, document_type: docType },
      });
    } catch (docError) {
      console.error(`Error generating ${docType}:`, docError);
      await documentRepo.updateStatusByType(supabase, job.order_id, docType, "failed", {
        error_message: docError instanceof Error ? docError.message : "Unknown error",
      });
      jobFailedCount++;
    }
  }

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

  if (jobFailedCount > 0) {
    await updateJob(jobId, { status: "failed", completed_at: new Date().toISOString(), error: `${jobFailedCount} docs failed` });
    return ok({ message: "Partial failure", job_id: jobId, failed: jobFailedCount });
  }

  await updateJob(jobId, { status: "complete", completed_at: new Date().toISOString() });

  const finalJobStatus = job.attorney_review ? "review" : "delivered";
  await supabase.from("orders").update({ status: finalJobStatus }).eq("id", job.order_id);
  const jobDocPatch: Record<string, unknown> = { status: finalJobStatus };
  if (!job.attorney_review) jobDocPatch.delivered_at = new Date().toISOString();
  await supabase.from("documents").update(jobDocPatch).eq("order_id", job.order_id).eq("status", "generated");

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

  const docTypes = job.document_types;
  await auditLogRepo.insertEntry(supabase, {
    action: "documents.generation_complete",
    resource_type: "order",
    resource_id: job.order_id,
    metadata: { job_id: jobId, documents: docTypes },
  });

  return ok({ message: "Job processed", job_id: jobId });
});
