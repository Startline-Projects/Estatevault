import { NextResponse } from "next/server";
import { requireAuth, assertOrderAccess } from "@/lib/api/auth";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { admin, profile } = auth;

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");
  if (!orderId) return NextResponse.json({ error: "Missing order_id" }, { status: 400 });

  const access = await assertOrderAccess(admin, orderId, profile);
  if ("error" in access) return access.error;

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
