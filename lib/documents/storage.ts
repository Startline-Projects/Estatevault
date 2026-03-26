import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function uploadDocument(clientId: string, orderId: string, documentType: string, pdfBuffer: Buffer): Promise<string> {
  const supabase = createAdminClient();
  const path = `${clientId}/${orderId}/${documentType}.pdf`;

  const { error } = await supabase.storage.from("documents").upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  await supabase.from("documents").update({ storage_path: path, status: "generated", generated_at: new Date().toISOString() }).eq("order_id", orderId).eq("document_type", documentType);

  return path;
}

export async function getDocumentDownloadUrl(path: string, expiresIn: number = 3600): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase.storage.from("documents").createSignedUrl(path, expiresIn);
  return data?.signedUrl || "";
}
