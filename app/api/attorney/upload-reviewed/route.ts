import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { sealForRecipient } from "@/lib/documents/seal";
import { byteaToBytes } from "@/lib/api/crypto";
import { docxToPdf } from "@/lib/documents/convert";

export const maxDuration = 120; // conversion can take a few seconds

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Attorney uploads the edited DOCX. We keep the DOCX, convert it to PDF, seal the
// PDF to the client, and record reviewed_path. The client download then serves
// this PDF instead of the originally generated one. Originals are never overwritten.
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const documentId = form.get("documentId");
  const file = form.get("file");
  if (typeof documentId !== "string" || !documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  // Attorney uploads a Word document; we convert it to PDF for the client.
  const isDocx = file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
  if (!isDocx) {
    return NextResponse.json({ error: "Please upload a DOCX (Word) file." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be between 1 byte and 20 MB." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("documents")
    .select("id, client_id, order_id, document_type")
    .eq("id", documentId)
    .single();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Only the assigned attorney for this order (or admin) may upload.
  const { data: profile } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
  const isAdmin = profile?.user_type === "admin";
  const { data: ar } = await admin
    .from("attorney_reviews")
    .select("id, status")
    .eq("order_id", doc.order_id)
    .eq("attorney_id", user.id)
    .maybeSingle();
  if (!isAdmin && !ar) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const docxBytes = Buffer.from(await file.arrayBuffer());

  // Keep the original DOCX (audit + future re-edit). Stored plaintext, like the
  // generated review DOCX. Non-fatal if it fails.
  const srcPath = `${doc.client_id}/${doc.order_id}/${doc.document_type}.reviewed.src.docx`;
  const { error: srcErr } = await admin.storage.from("documents").upload(srcPath, docxBytes, {
    contentType: DOCX_MIME,
    upsert: true,
  });
  if (srcErr) console.warn("[upload-reviewed] source DOCX upload failed (non-fatal):", srcErr.message);

  // Convert DOCX -> PDF (the client always receives a PDF).
  let pdfBytes: Buffer;
  try {
    pdfBytes = await docxToPdf(docxBytes);
  } catch (e) {
    console.error("[upload-reviewed] DOCX->PDF conversion failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not convert the document to PDF." },
      { status: 502 },
    );
  }

  // Seal the converted PDF to the client (plaintext fallback if no pubkey).
  const { data: client } = await admin
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
    } else {
      console.warn(`[upload-reviewed] client pubkey wrong length (${recipPub.length}), uploading plaintext`);
    }
  }

  const path = `${doc.client_id}/${doc.order_id}/${doc.document_type}.reviewed.pdf`;
  const { error: upErr } = await admin.storage.from("documents").upload(path, toUpload, {
    contentType: sealed ? "application/octet-stream" : "application/pdf",
    upsert: true,
  });
  if (upErr) {
    console.error("[upload-reviewed] storage upload failed:", upErr);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // Core update — must succeed for the client to receive the edited PDF.
  const { error: updErr } = await admin.from("documents").update({
    reviewed_path: path,
    reviewed_sealed: sealed,
    reviewed_for_user_id: sealedFor,
    reviewed_uploaded_at: new Date().toISOString(),
    reviewed_by: user.id,
  }).eq("id", documentId);
  if (updErr) {
    console.error("[upload-reviewed] documents update failed:", updErr);
    return NextResponse.json({ error: "Failed to record upload (is the migration applied?)" }, { status: 500 });
  }

  // Source-DOCX pointer — requires 20260521_attorney_reviewed_src.sql. Tolerate
  // failure so the edited PDF still reaches the client on older envs.
  if (!srcErr) {
    const { error: srcUpdErr } = await admin.from("documents")
      .update({ reviewed_src_path: srcPath }).eq("id", documentId);
    if (srcUpdErr) console.warn("[upload-reviewed] reviewed_src_path update failed (apply 20260521_attorney_reviewed_src.sql):", srcUpdErr.message);
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "attorney_review.reviewed_doc_uploaded",
    resource_type: "document",
    resource_id: documentId,
    metadata: { document_type: doc.document_type, order_id: doc.order_id, sealed, converted_from: "docx" },
  });

  return NextResponse.json({ success: true });
}
