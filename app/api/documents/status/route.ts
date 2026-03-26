import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");
  if (!orderId) return NextResponse.json({ error: "Missing order_id" }, { status: 400 });

  const admin = createAdminClient();

  const { data: order } = await admin.from("orders").select("status, product_type, attorney_review_requested").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: docs } = await admin.from("documents").select("id, document_type, status, storage_path").eq("order_id", orderId);

  const documents = (docs || []).map((d) => ({
    type: d.document_type,
    status: d.status,
    download_url: d.storage_path ? `/api/documents/download?id=${d.id}` : null,
  }));

  const allGenerated = documents.every((d) => d.status === "generated" || d.status === "delivered");
  const allDelivered = documents.every((d) => d.status === "delivered");

  let status: string;
  if (allDelivered) status = "complete";
  else if (allGenerated && order.attorney_review_requested) status = "review";
  else if (allGenerated) status = "complete";
  else if (order.status === "generating") status = "generating";
  else status = order.status;

  return NextResponse.json({ status, documents, order_status: order.status });
}
