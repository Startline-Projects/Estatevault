import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { sendApprovalEmail } from "@/lib/email";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
  // Auth check, only the assigned attorney or admin can approve
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { reviewId, decision, notes } = await request.json();
  if (!reviewId || !decision) {
    return NextResponse.json({ error: "Missing reviewId or decision" }, { status: 400 });
  }

  const validDecisions = ["approved", "approved_with_notes", "flagged"];
  if (!validDecisions.includes(decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  // Verify caller is the assigned attorney or admin
  const { data: profile } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
  const isAdmin = profile?.user_type === "admin";

  const { data: review } = await admin
    .from("attorney_reviews")
    .select("id, order_id, attorney_id, status")
    .eq("id", reviewId)
    .single();

  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  if (!isAdmin && review.attorney_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update attorney_reviews, use admin client so RLS is bypassed
  const { error: reviewErr } = await admin
    .from("attorney_reviews")
    .update({ status: decision, notes: notes || null, reviewed_at: new Date().toISOString() })
    .eq("id", reviewId);

  if (reviewErr) {
    console.error("Failed to update attorney_reviews:", reviewErr);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }

  if (decision === "approved" || decision === "approved_with_notes") {
    // Unlock order and documents, admin client bypasses all RLS
    const { error: orderErr } = await admin
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", review.order_id);

    if (orderErr) {
      console.error("Failed to update order status:", orderErr);
      return NextResponse.json({ error: "Failed to unlock order" }, { status: 500 });
    }

    const { error: docsErr } = await admin
      .from("documents")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("order_id", review.order_id);

    if (docsErr) {
      console.error("Failed to update documents status:", docsErr);
      return NextResponse.json({ error: "Failed to unlock documents" }, { status: 500 });
    }

    // Fetch client email for notification
    const { data: order } = await admin
      .from("orders")
      .select("product_type, client_id, partner_id")
      .eq("id", review.order_id)
      .single();

    let clientEmail: string | null = null;
    let productType: "will" | "trust" = "will";

    if (order) {
      productType = (order.product_type as "will" | "trust") || "will";
      const { data: client } = await admin
        .from("clients")
        .select("profile_id")
        .eq("id", order.client_id)
        .single();

      if (client?.profile_id) {
        const { data: clientProfile } = await admin
          .from("profiles")
          .select("email")
          .eq("id", client.profile_id)
          .single();
        clientEmail = clientProfile?.email || null;
      }
    }

    // Send approval email to client
    if (clientEmail) {
      const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us"}/dashboard/documents`;
      await sendApprovalEmail({ to: clientEmail, productType, dashboardUrl, partnerId: order?.partner_id });
    } else {
      console.error("Could not find client email for review:", reviewId);
    }
  }

  // Audit log
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: `attorney_review.${decision}`,
    resource_type: "attorney_review",
    resource_id: reviewId,
    metadata: { notes: notes || null, order_id: review.order_id },
  });

  return NextResponse.json({ success: true });
}
