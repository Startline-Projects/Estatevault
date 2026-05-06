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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only review attorneys or admins can call this
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
  if (!profile || (profile.user_type !== "review_attorney" && profile.user_type !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reviewId } = await request.json();
  if (!reviewId) return NextResponse.json({ error: "Missing reviewId" }, { status: 400 });

  // Get review → order → client → profile email
  const { data: review } = await admin
    .from("attorney_reviews")
    .select("order_id, orders(product_type, client_id, partner_id, clients(profiles(email)))")
    .eq("id", reviewId)
    .single();

  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  const order = (review.orders as unknown) as Record<string, unknown> | null;
  const productType = (order?.product_type as "will" | "trust") || "will";
  const client = (order?.clients as unknown) as Record<string, unknown> | null;
  const clientProfile = (client?.profiles as unknown) as { email: string } | null;
  const email = clientProfile?.email;

  if (!email) return NextResponse.json({ error: "Client email not found" }, { status: 404 });

  const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us"}/dashboard/documents`;

  const partnerId = (order?.partner_id as string | null) || null;
  await sendApprovalEmail({ to: email, productType, dashboardUrl, partnerId });

  return NextResponse.json({ success: true });
}
