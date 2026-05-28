import { type NextRequest } from "next/server";
import Stripe from "stripe";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import { getDocumentDownloadUrl } from "@/lib/documents/storage";

export const GET = withRoute(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("id");
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");

  if (!documentId) return fail("Missing document id", 400);
  if (!sessionId && !orderId) return fail("Missing session_id or order_id", 400);

  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("documents")
    .select("storage_path, order_id")
    .eq("id", documentId)
    .single();
  if (!doc || !doc.storage_path) return fail("Document not found", 404);

  let authorized = false;

  if (sessionId) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionOrderId = session.metadata?.order_id;
    if (sessionOrderId && sessionOrderId === doc.order_id) authorized = true;
  }

  if (!authorized && orderId && orderId === doc.order_id) {
    const { data: order } = await admin
      .from("orders")
      .select("id, order_type, promo_code")
      .eq("id", orderId)
      .single();
    if (order && (order.order_type === "test" || order.promo_code)) authorized = true;
  }

  if (!authorized) return fail("Access denied", 403);

  const url = await getDocumentDownloadUrl(doc.storage_path);
  if (!url) return fail("File not available", 404);

  return ok({ url });
});
