import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { claude, CLAUDE_MODEL } from "@/lib/claude";
import { popNextJob, getJob, updateJob, ratelimit } from "@/lib/queue/document-queue";
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

export async function GET() {
  try {
    const jobId = await popNextJob();
    if (!jobId) return NextResponse.json({ message: "No jobs in queue" });

    const job = await getJob(jobId);
    if (!job) return NextResponse.json({ message: "Job not found" });

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
      return NextResponse.json({ message: "Anthropic API key not configured" });
    }

    await updateJob(jobId, { status: "processing", started_at: new Date().toISOString(), attempts: job.attempts + 1 });

    const supabase = createAdminClient();
    const intake = job.intake_answers;

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

        const response = await claude.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 8000,
          system: template.systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        const documentText = response.content[0].type === "text" ? response.content[0].text : "";

        // Generate PDF
        const { generatePDF } = await import("@/lib/documents/generate-pdf");
        const pdfBuffer = await generatePDF(documentText, docType, String(intake.firstName || "") + " " + String(intake.lastName || ""), undefined);

        // Upload to storage
        await uploadDocument(job.client_id, job.order_id, docType, pdfBuffer);

        await supabase.from("audit_log").insert({ action: "document.generated", resource_type: "document", metadata: { order_id: job.order_id, document_type: docType } });
      } catch (docError) {
        console.error(`Error generating ${docType}:`, docError);
        // Continue with other documents
      }
    }

    // Mark job complete
    await updateJob(jobId, { status: "complete", completed_at: new Date().toISOString() });

    // Update order status
    if (job.attorney_review) {
      await supabase.from("orders").update({ status: "review" }).eq("id", job.order_id);
    } else {
      await supabase.from("orders").update({ status: "delivered" }).eq("id", job.order_id);

      // Update document statuses to delivered
      await supabase.from("documents").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("order_id", job.order_id);
    }

    // Auto-populate vault
    const docTypes = job.document_types;
    for (const dt of docTypes) {
      await supabase.from("vault_items").upsert({
        client_id: job.client_id,
        category: "estate_document",
        label: `${dt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — ${new Date().toLocaleDateString()}`,
        data: { document_type: dt, order_id: job.order_id, generated_date: new Date().toISOString(), is_auto_generated: true },
      }, { onConflict: "id" });
    }

    await supabase.from("audit_log").insert({ action: "documents.generation_complete", resource_type: "order", resource_id: job.order_id, metadata: { job_id: jobId, documents: docTypes } });

    return NextResponse.json({ message: "Job processed", job_id: jobId });
  } catch (error) {
    console.error("Document processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
