import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

const EXPECTED_DOCS: Record<string, string[]> = {
  will: ["will", "poa", "healthcare_directive"],
  trust: ["trust", "pour_over_will", "poa", "healthcare_directive"],
};

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();
  if (profile?.user_type !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: orders, error: ordersErr } = await admin
    .from("orders")
    .select("id, client_id, product_type, status, order_type, created_at, attorney_review_requested")
    .in("product_type", ["will", "trust"])
    .in("status", ["generating", "review", "delivered"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 });
  if (!orders?.length) return NextResponse.json({ orders: [] });

  const orderIds = orders.map((o) => o.id);
  const { data: docs } = await admin
    .from("documents")
    .select("id, order_id, document_type, status, storage_path")
    .in("order_id", orderIds);

  const clientIds = Array.from(new Set(orders.map((o) => o.client_id).filter(Boolean))) as string[];
  const clientInfoMap = new Map<string, { email: string | null; fullName: string | null }>();
  if (clientIds.length) {
    const { data: clientRows } = await admin
      .from("clients")
      .select("id, profile_id")
      .in("id", clientIds);
    const profileIds = (clientRows || []).map((c) => c.profile_id).filter(Boolean) as string[];
    const { data: profiles } = profileIds.length
      ? await admin.from("profiles").select("id, email, full_name").in("id", profileIds)
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
    missing: string[];
    hasPendingRows: boolean;
    isAttorneyReview: boolean;
  }> = [];

  for (const o of orders) {
    const expected = EXPECTED_DOCS[o.product_type] || [];
    const orderDocs = (docs || []).filter((d) => d.order_id === o.id);
    const ready = new Set(orderDocs.filter((d) => d.storage_path).map((d) => d.document_type));
    const missing = expected.filter((t) => !ready.has(t));
    const hasPendingRows = orderDocs.some((d) => !d.storage_path);
    if (missing.length === 0 && !hasPendingRows) continue;
    const client = (o.client_id ? clientInfoMap.get(o.client_id) : null) || { email: null, fullName: null };
    result.push({
      orderId: o.id,
      productType: o.product_type,
      status: o.status,
      createdAt: o.created_at,
      clientEmail: client.email,
      clientName: client.fullName,
      expected,
      missing,
      hasPendingRows,
      isAttorneyReview: !!o.attorney_review_requested,
    });
  }

  return NextResponse.json({ orders: result });
}
