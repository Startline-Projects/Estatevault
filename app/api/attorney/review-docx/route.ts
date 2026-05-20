import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { getDocumentDownloadUrl } from "@/lib/documents/storage";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

// Returns a signed URL for the editable DOCX generated for attorney review.
// Sealed to the attorney's pubkey when available (sealed=true → client decrypts
// in the crypto worker). Only the assigned attorney or an admin may fetch it.
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "Missing documentId" }, { status: 400 });

  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("documents")
    .select("order_id, document_type, review_docx_path, review_docx_for")
    .eq("id", documentId)
    .single();
  if (!doc || !doc.review_docx_path) {
    return NextResponse.json({ error: "No editable document available." }, { status: 404 });
  }

  // Only the assigned attorney for this order (or admin) may download.
  const { data: profile } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
  const isAdmin = profile?.user_type === "admin";

  let isAssigned = false;
  const { data: ar } = await admin
    .from("attorney_reviews")
    .select("id")
    .eq("order_id", doc.order_id)
    .eq("attorney_id", user.id)
    .maybeSingle();
  if (ar) isAssigned = true;

  if (!isAdmin && !isAssigned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sealed = !!doc.review_docx_for;
  // A sealed DOCX can only be opened by the attorney it was sealed for.
  if (sealed && doc.review_docx_for !== user.id) {
    return NextResponse.json({ error: "This editable copy is sealed to a different attorney." }, { status: 403 });
  }

  const url = await getDocumentDownloadUrl(doc.review_docx_path);
  if (!url) return NextResponse.json({ error: "File not available" }, { status: 404 });

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "document.review_docx_downloaded",
    resource_type: "document",
    resource_id: documentId,
    metadata: { document_type: doc.document_type, sealed },
  });

  return NextResponse.json({ url, sealed, filename: `${doc.document_type}.docx` });
}
