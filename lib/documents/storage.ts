import { createServerClient } from "@supabase/ssr";
import { sealForRecipient } from "./seal";
import { byteaToBytes } from "@/lib/api/crypto";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

// Hybrid E2EE upload:
// - If client has pubkey_x25519 (crypto bootstrap done) → seal PDF, upload .bin
//   (path suffix .pdf preserved for compatibility with download flow logic).
// - If no pubkey → legacy plaintext upload (unchanged).
//
// Plaintext PDF buffer is discarded after seal. Server retains no copy.
//
// Optionally seals a parallel copy to the assigned review attorney.
export async function uploadDocument(
  clientId: string,
  orderId: string,
  documentType: string,
  pdfBuffer: Buffer,
): Promise<string> {
  const supabase = createAdminClient();
  const path = `${clientId}/${orderId}/${documentType}.pdf`;

  const { data: client } = await supabase
    .from("clients")
    .select("profile_id, pubkey_x25519")
    .eq("id", clientId)
    .single();

  let toUpload: Uint8Array = new Uint8Array(pdfBuffer);
  let sealed = false;
  let sealedFor: string | null = null;

  if (client?.pubkey_x25519) {
    const recipPub = byteaToBytes(client.pubkey_x25519);
    if (recipPub.length === 32) {
      toUpload = await sealForRecipient(toUpload, recipPub);
      sealed = true;
      sealedFor = client.profile_id ?? null;
    } else {
      console.warn(`[uploadDocument] client pubkey wrong length (${recipPub.length}), uploading plaintext`);
    }
  }

  const { error } = await supabase.storage
    .from("documents")
    .upload(path, toUpload, {
      contentType: sealed ? "application/octet-stream" : "application/pdf",
      upsert: true,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  // Try to also seal a copy for the assigned review attorney, if any.
  let attorneySealedPath: string | null = null;
  let attorneySealedFor: string | null = null;
  if (sealed) {
    const { data: review } = await supabase
      .from("attorney_reviews")
      .select("attorney_id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (review?.attorney_id) {
      const { data: att } = await supabase
        .from("clients")
        .select("pubkey_x25519")
        .eq("profile_id", review.attorney_id)
        .maybeSingle();
      if (att?.pubkey_x25519) {
        const attPub = byteaToBytes(att.pubkey_x25519);
        if (attPub.length !== 32) {
          console.warn(`[uploadDocument] attorney pubkey wrong length (${attPub.length}), skipping attorney seal`);
        } else {
        const attSealed = await sealForRecipient(new Uint8Array(pdfBuffer), attPub);
        attorneySealedPath = `${clientId}/${orderId}/${documentType}.attorney.bin`;
        const r = await supabase.storage.from("documents").upload(attorneySealedPath, attSealed, {
          contentType: "application/octet-stream",
          upsert: true,
        });
        if (!r.error) attorneySealedFor = review.attorney_id;
        else attorneySealedPath = null;
        }
      }
    }
  }

  // Discard plaintext reference. (GC handles the rest.)
  toUpload = new Uint8Array(0);

  // Core update — must succeed for the doc to surface in client UI. Kept
  // separate so a missing phase12 migration cannot wedge status=pending.
  const coreUpd = await supabase.from("documents").update({
    storage_path: path,
    status: "generated",
    generated_at: new Date().toISOString(),
  }).eq("order_id", orderId).eq("document_type", documentType);
  if (coreUpd.error) {
    throw new Error(`documents update failed: ${coreUpd.error.message}`);
  }

  // Extended update — requires 20260509_e2ee_phase12_documents.sql. Tolerate
  // failure so older envs still generate working docs.
  const extUpd = await supabase.from("documents").update({
    sealed,
    sealed_for_user_id: sealedFor,
    attorney_sealed_path: attorneySealedPath,
    attorney_sealed_for: attorneySealedFor,
  }).eq("order_id", orderId).eq("document_type", documentType);
  if (extUpd.error) {
    console.warn("[uploadDocument] sealed columns update failed (apply 20260509_e2ee_phase12_documents.sql):", extUpd.error.message);
  }

  await supabase.from("audit_log").insert({
    actor_id: sealedFor,
    action: sealed ? "document.sealed_uploaded" : "document.plaintext_uploaded",
    resource_type: "document",
    resource_id: orderId,
    metadata: {
      document_type: documentType,
      sealed,
      attorney_copy: !!attorneySealedPath,
    },
  }).then(() => undefined, () => undefined);

  return path;
}

export async function getDocumentDownloadUrl(path: string, expiresIn: number = 3600): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase.storage.from("documents").createSignedUrl(path, expiresIn);
  return data?.signedUrl || "";
}
