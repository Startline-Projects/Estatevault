import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Stripe from "stripe";
import { getDocumentDownloadUrl } from "@/lib/documents/storage";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Public download. Authorizes via Stripe session_id OR order_id (test/promo flow).
// Used on /trust/success and /will/success before user has set password.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("id");
    const sessionId = searchParams.get("session_id");
    const orderId = searchParams.get("order_id");

    if (!documentId) return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    if (!sessionId && !orderId) return NextResponse.json({ error: "Missing session_id or order_id" }, { status: 400 });

    const admin = createAdminClient();

    const { data: doc } = await admin
      .from("documents")
      .select("storage_path, order_id")
      .eq("id", documentId)
      .single();
    if (!doc || !doc.storage_path) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // Authorization
    let authorized = false;

    if (sessionId) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" });
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const sessionOrderId = session.metadata?.order_id;
      if (sessionOrderId && sessionOrderId === doc.order_id) authorized = true;
    }

    if (!authorized && orderId && orderId === doc.order_id) {
      // Promo/test flow has no Stripe session
      const { data: order } = await admin.from("orders").select("id, status").eq("id", orderId).single();
      if (order) authorized = true;
    }

    if (!authorized) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const url = await getDocumentDownloadUrl(doc.storage_path);
    if (!url) return NextResponse.json({ error: "File not available" }, { status: 404 });

    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
