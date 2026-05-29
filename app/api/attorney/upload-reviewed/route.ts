import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { sealForRecipient } from "@/lib/documents/seal";
import { byteaToBytes } from "@/lib/api/crypto";
import { docxToPdf } from "@/lib/documents/convert";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["review_attorney", "admin"]);
  if ("error" in auth) return auth.error;

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid form data", 400);

  const documentId = form.get("documentId");
  const file = form.get("file");
  if (typeof documentId !== "string" || !documentId) return fail("Missing documentId", 400);
  if (!(file instanceof File)) return fail("Missing file", 400);

  const isDocx = file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
  if (!isDocx) return fail("Please upload a DOCX (Word) file.", 400);
  if (file.size === 0 || file.size > MAX_BYTES) return fail("File must be between 1 byte and 20 MB.", 400);

  const { data: doc } = await auth.admin
    .from("documents")
    .select("id, client_id, order_id, document_type")
    .eq("id", documentId)
    .single();
  if (!doc) return fail("Document not found", 404);
  if (!doc.order_id) return fail("Document has no associated order", 400);
  if (!doc.client_id) return fail("Document has no associated client", 400);

  const isAdmin = auth.profile.user_type === "admin";
  const { data: ar } = await attorneyReviewRepo.isAssignedAttorney(auth.admin, doc.order_id, auth.user.id);
  if (!isAdmin && !ar) return fail("Forbidden", 403);

  const docxBytes = Buffer.from(await file.arrayBuffer());

  const srcPath = `${doc.client_id}/${doc.order_id}/${doc.document_type}.reviewed.src.docx`;
  const { error: srcErr } = await auth.admin.storage.from("documents").upload(srcPath, docxBytes, {
    contentType: DOCX_MIME,
    upsert: true,
  });
  if (srcErr) console.warn("[upload-reviewed] source DOCX upload failed (non-fatal):", srcErr.message);

  let pdfBytes: Buffer;
  try {
    pdfBytes = await docxToPdf(docxBytes);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not convert the document to PDF.", 502);
  }

  const { data: client } = await auth.admin
    .from("clients")
    .select("profile_id, pubkey_x25519")
    .eq("id", doc.client_id)
    .single();

  let toUpload: Uint8Array = new Uint8Array(pdfBytes);
  let sealed = false;
  let sealedFor: string | null = null;

  if (client?.pubkey_x25519) {
    const recipPub = byteaToBytes(client.pubkey_x25519);
    if (recipPub.length === 32) {
      toUpload = await sealForRecipient(toUpload, recipPub);
      sealed = true;
      sealedFor = client.profile_id ?? null;
    }
  }

  const path = `${doc.client_id}/${doc.order_id}/${doc.document_type}.reviewed.pdf`;
  const { error: upErr } = await auth.admin.storage.from("documents").upload(path, toUpload, {
    contentType: sealed ? "application/octet-stream" : "application/pdf",
    upsert: true,
  });
  if (upErr) return fail("Upload failed", 500);

  const { error: updErr } = await auth.admin.from("documents").update({
    reviewed_path: path,
    reviewed_sealed: sealed,
    reviewed_for_user_id: sealedFor,
    reviewed_uploaded_at: new Date().toISOString(),
    reviewed_by: auth.user.id,
  }).eq("id", documentId);
  if (updErr) return fail("Failed to record upload", 500);

  if (!srcErr) {
    const { error: srcUpdErr } = await auth.admin.from("documents")
      .update({ reviewed_src_path: srcPath }).eq("id", documentId);
    if (srcUpdErr) console.warn("[upload-reviewed] reviewed_src_path update failed:", srcUpdErr.message);
  }

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "attorney_review.reviewed_doc_uploaded",
    resource_type: "document",
    resource_id: documentId,
    metadata: { document_type: doc.document_type, order_id: doc.order_id, sealed, converted_from: "docx" },
  });

  return ok({ success: true });
});
