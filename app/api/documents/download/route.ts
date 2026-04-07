import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { getDocumentDownloadUrl } from "@/lib/documents/storage";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("id");
  if (!documentId) return NextResponse.json({ error: "Missing document id" }, { status: 400 });

  const admin = createAdminClient();

  // Get document
  const { data: doc } = await admin.from("documents").select("storage_path, client_id, order_id").eq("id", documentId).single();
  if (!doc || !doc.storage_path) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Verify access: client owns it OR partner has access
  const { data: client } = await admin.from("clients").select("profile_id, partner_id").eq("id", doc.client_id).single();
  if (!client) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const isClient = client.profile_id === user.id;
  let isPartner = false;
  if (client.partner_id) {
    const { data: partner } = await admin.from("partners").select("profile_id").eq("id", client.partner_id).single();
    if (partner?.profile_id === user.id) isPartner = true;
  }

  const { data: profile } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
  const isAdmin = profile?.user_type === "admin";

  // Check if user is a review attorney assigned to this order
  let isReviewAttorney = false;
  if (profile?.user_type === "review_attorney") {
    const { data: ar } = await admin
      .from("attorney_reviews")
      .select("id")
      .eq("order_id", doc.order_id)
      .eq("attorney_id", user.id)
      .single();
    if (ar) isReviewAttorney = true;
  }

  if (!isClient && !isPartner && !isAdmin && !isReviewAttorney) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Block client download while order is under attorney review
  if (isClient && !isAdmin) {
    const { data: order } = await admin
      .from("orders")
      .select("status")
      .eq("id", doc.order_id)
      .single();
    if (order?.status === "review") {
      return NextResponse.json({ error: "Documents are under attorney review and will be available once approved." }, { status: 403 });
    }
  }

  const url = await getDocumentDownloadUrl(doc.storage_path);
  if (!url) return NextResponse.json({ error: "File not available" }, { status: 404 });

  // Audit log
  await admin.from("audit_log").insert({ actor_id: user.id, action: "document.downloaded", resource_type: "document", resource_id: documentId });

  return NextResponse.json({ url });
}
