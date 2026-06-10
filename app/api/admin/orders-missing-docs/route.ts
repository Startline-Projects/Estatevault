import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";

const EXPECTED_DOCS: Record<string, string[]> = {
  will: ["will", "poa", "healthcare_directive"],
  trust: ["trust", "pour_over_will", "poa", "healthcare_directive"],
};

export const GET = withRoute(async (_req: NextRequest) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const { data: orders, error: ordersErr } = await auth.admin
    .from("orders")
    .select(
      "id, client_id, product_type, status, order_type, created_at, attorney_review_requested, stripe_session_id, stripe_payment_intent_id",
    )
    .in("product_type", ["will", "trust"])
    // Include paid-but-stuck states alongside in-flight ones:
    //  - pending: paid (Stripe session/intent set) but webhook never advanced it (BUG-1)
    //  - failed:  generation/queue failed (BUG-13)
    .in("status", ["pending", "failed", "generating", "review", "delivered"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (ordersErr) {
    console.error("[admin/orders-missing-docs]", ordersErr);
    return fail("could not load orders", 500);
  }
  if (!orders?.length) return ok({ orders: [] });

  const orderIds = orders.map((o) => o.id);
  const { data: docs } = await auth.admin
    .from("documents")
    .select("id, order_id, document_type, status, storage_path")
    .in("order_id", orderIds);

  const clientIds = Array.from(new Set(orders.map((o) => o.client_id).filter(Boolean))) as string[];
  const clientInfoMap = new Map<string, { email: string | null; fullName: string | null }>();
  if (clientIds.length) {
    const { data: clientRows } = await auth.admin
      .from("clients")
      .select("id, profile_id")
      .in("id", clientIds);
    const profileIds = (clientRows || []).map((c) => c.profile_id).filter(Boolean) as string[];
    const { data: profiles } = profileIds.length
      ? await auth.admin.from("profiles").select("id, email, full_name").in("id", profileIds)
      : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
    const profileById = new Map(
      (profiles || []).map((p) => [p.id, { email: p.email, fullName: p.full_name }])
    );
    for (const c of clientRows || []) {
      clientInfoMap.set(c.id, profileById.get(c.profile_id!) || { email: null, fullName: null });
    }
  }

  const result: Array<{
    orderId: string;
    productType: string;
    status: string;
    createdAt: string;
    clientEmail: string | null;
    clientName: string | null;
    expected: string[];
    present: string[];
    missing: string[];
    hasPendingRows: boolean;
    isAttorneyReview: boolean;
    failureKind: "webhook_missed" | "queue_failed" | "partially_delivered" | "missing_docs";
  }> = [];

  for (const o of orders) {
    // A paid order is one Stripe actually charged — has a session or payment
    // intent on file. Unpaid abandoned `pending` carts are skipped.
    const isPaid = !!(o.stripe_session_id || o.stripe_payment_intent_id);
    // BUG-1: paid order webhook never advanced it past `pending`.
    const webhookMissed = o.status === "pending" && isPaid;
    // BUG-13: generation/queue failed.
    const queueFailed = o.status === "failed";

    const expected = EXPECTED_DOCS[o.product_type] || [];
    const orderDocs = (docs || []).filter((d) => d.order_id === o.id);
    const ready = new Set(orderDocs.filter((d) => d.storage_path).map((d) => d.document_type));
    const present = expected.filter((t) => ready.has(t));
    const missing = expected.filter((t) => !ready.has(t));
    const hasPendingRows = orderDocs.some((d) => !d.storage_path);

    // Surface a row if it is a known stuck/failed state, or an in-flight order
    // that is genuinely missing finished documents.
    const isMissingDocs = missing.length > 0 || hasPendingRows;
    if (!webhookMissed && !queueFailed && !isMissingDocs) continue;
    // Skip unpaid `pending` carts that were simply abandoned.
    if (o.status === "pending" && !isPaid) continue;

    // "Partially delivered" = some PDFs made, some still missing — distinct from
    // an order where none were produced.
    const partial = present.length > 0 && missing.length > 0;
    const failureKind: "webhook_missed" | "queue_failed" | "partially_delivered" | "missing_docs" =
      webhookMissed
        ? "webhook_missed"
        : queueFailed
          ? "queue_failed"
          : partial
            ? "partially_delivered"
            : "missing_docs";

    const client = (o.client_id ? clientInfoMap.get(o.client_id) : null) || { email: null, fullName: null };
    result.push({
      orderId: o.id,
      productType: o.product_type,
      status: o.status ?? "",
      createdAt: o.created_at ?? "",
      clientEmail: client.email,
      clientName: client.fullName,
      expected,
      present,
      missing,
      hasPendingRows,
      isAttorneyReview: !!o.attorney_review_requested,
      failureKind,
    });
  }

  return ok({ orders: result });
});
