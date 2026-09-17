import { type NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { requireAuth, assertOrderAccess } from "@/lib/api/auth";
import { expectedDocumentTypes } from "@/lib/documents/trust-package";

export const GET = withRoute(async (request: NextRequest) => {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { admin, profile } = auth;

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");
  if (!orderId) return fail("Missing order_id", 400);

  const access = await assertOrderAccess(admin, orderId, profile);
  if ("error" in access) return access.error;

  const { data: order } = await admin
    .from("orders")
    .select("status, product_type, attorney_review_requested, intake_data")
    .eq("id", orderId)
    .single();
  if (!order) return fail("Order not found", 404);

  const { data: docs } = await admin
    .from("documents")
    .select("id, document_type, status, storage_path")
    .eq("order_id", orderId);

  const documents = (docs || []).map((d) => ({
    type: d.document_type,
    status: d.status,
    download_url: d.storage_path ? `/api/documents/download?id=${d.id}` : null,
  }));

  // Completeness is measured against what the order OWES, not against whatever
  // rows happen to exist. A trust order that created four of its eight rows
  // used to report "complete" once those four generated — the client saw a
  // finished order missing half the package.
  const expected = expectedDocumentTypes(
    order.product_type ?? "",
    order.intake_data as Record<string, unknown> | null,
  );
  const present = new Set(documents.map((d) => d.type));
  const missingTypes = expected.filter((t) => !present.has(t));

  const ready = (d: { status: string | null }) => d.status === "generated" || d.status === "delivered";
  const allGenerated = missingTypes.length === 0 && documents.every(ready);
  const allDelivered = missingTypes.length === 0 && documents.every((d) => d.status === "delivered");

  let status: string;
  if (allDelivered) status = "complete";
  else if (allGenerated && order.attorney_review_requested) status = "review";
  else if (allGenerated) status = "complete";
  else if (order.status === "generating") status = "generating";
  else status = order.status ?? "";

  return ok({
    status,
    documents,
    order_status: order.status,
    // Named so an incomplete package is visible rather than silently "complete".
    expected_document_types: expected,
    missing_document_types: missingTypes,
  });
});
