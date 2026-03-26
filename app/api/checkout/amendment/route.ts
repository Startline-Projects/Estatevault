import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function POST(request: Request) {
  try {
    const { userId, changeType, description } = await request.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const authClient = createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user || user.id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminClient();
    const { data: client } = await supabase.from("clients").select("id").eq("profile_id", userId).single();
    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    const { data: order, error: orderError } = await supabase.from("orders").insert({
      client_id: client.id,
      product_type: "amendment",
      status: "pending",
      amount_total: 5000,
      ev_cut: 5000,
      acknowledgment_signed: true,
      acknowledgment_signed_at: new Date().toISOString(),
    }).select("id").single();

    if (orderError || !order) return NextResponse.json({ error: "Failed to create order" }, { status: 500 });

    await supabase.from("quiz_sessions").insert({ client_id: client.id, answers: { changeType, description }, recommendation: "will", completed: true });

    const origin = request.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price_data: { currency: "usd", product_data: { name: "Document Amendment", description: `${changeType}: ${description.substring(0, 100)}` }, unit_amount: 5000 }, quantity: 1 }],
      success_url: `${origin}/dashboard/documents?amended=true`,
      cancel_url: `${origin}/dashboard/amendment`,
      metadata: { order_id: order.id, client_id: client.id, product_type: "amendment", attorney_review: "false" },
    });

    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Amendment checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
