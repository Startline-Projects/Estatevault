import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const reviewId = searchParams.get("id");
  if (!reviewId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();

  // Verify the requesting user is the assigned attorney (or admin)
  const { data: profile } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
  const isAdmin = profile?.user_type === "admin";

  const { data: review } = await admin
    .from("attorney_reviews")
    .select("id, order_id, status, sla_deadline, created_at, partner_id, attorney_id")
    .eq("id", reviewId)
    .single();

  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  // Only assigned attorney or admin can view
  if (!isAdmin && review.attorney_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch order
  const { data: order } = await admin
    .from("orders")
    .select("id, product_type, client_id, amount_total")
    .eq("id", review.order_id)
    .single();

  // Fetch client → profile
  let clientName: string | null = null;
  let clientEmail: string | null = null;
  if (order?.client_id) {
    const { data: client } = await admin
      .from("clients")
      .select("id, profile_id")
      .eq("id", order.client_id)
      .single();

    if (client?.profile_id) {
      const { data: clientProfile } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", client.profile_id)
        .single();
      clientName = clientProfile?.full_name || clientProfile?.email || null;
      clientEmail = clientProfile?.email || null;
    }
  }

  // Fetch partner
  let partnerCompany: string | null = null;
  if (review.partner_id) {
    const { data: partner } = await admin
      .from("partners")
      .select("company_name")
      .eq("id", review.partner_id)
      .single();
    partnerCompany = partner?.company_name || null;
  }

  // Fetch documents
  const { data: documents } = await admin
    .from("documents")
    .select("id, document_type, storage_path, status")
    .eq("order_id", review.order_id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    review: {
      id: review.id,
      order_id: review.order_id,
      status: review.status,
      sla_deadline: review.sla_deadline,
      created_at: review.created_at,
    },
    order: {
      product_type: order?.product_type || "will",
      amount_total: order?.amount_total || 0,
    },
    client: { name: clientName, email: clientEmail },
    partner: { company: partnerCompany },
    documents: (documents || []).map((d) => ({
      id: d.id,
      document_type: d.document_type,
      storage_path: d.storage_path,
      status: d.status,
    })),
  });
}
