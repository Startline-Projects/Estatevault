import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { calculateSplit } from "@/lib/stripe-payouts";

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
    const { data: client } = await supabase
      .from("clients")
      .select("id, vault_subscription_status, partner_id")
      .eq("profile_id", userId)
      .single();
    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    // Look up partner tier if this client came through a partner
    let partnerId: string | null = client.partner_id || null;
    let partnerTier: "standard" | "enterprise" = "standard";
    if (partnerId) {
      const { data: partner } = await supabase
        .from("partners")
        .select("tier")
        .eq("id", partnerId)
        .single();
      if (partner?.tier) partnerTier = partner.tier as "standard" | "enterprise";
    }

    const isSubscriber = client.vault_subscription_status === "active";

    if (isSubscriber) {
      // Free amendment for active subscribers, bypass Stripe
      const { data: order, error: orderError } = await supabase.from("orders").insert({
        client_id: client.id,
        product_type: "amendment",
        status: "generating",
        amount_total: 0,
        ev_cut: 0,
        amendment_type: "subscription_included",
        acknowledgment_signed: true,
        acknowledgment_signed_at: new Date().toISOString(),
      }).select("id").single();

      if (orderError || !order) return NextResponse.json({ error: "Failed to create order" }, { status: 500 });

      await supabase.from("quiz_sessions").insert({
        client_id: client.id,
        answers: { changeType, description },
        recommendation: "will",
        completed: true,
      });

      // Audit log
      await supabase.from("audit_log").insert({
        actor_id: user.id,
        action: "amendment.subscription_included",
        resource_type: "order",
        resource_id: order.id,
        metadata: { amendment_type: "subscription_included", change_type: changeType },
      });

      return NextResponse.json({ free: true, orderId: order.id, url: "/dashboard/documents?amended=true" });
    }

    // Paid amendment, normal Stripe flow
    const { evCut, partnerCut } = partnerId
      ? calculateSplit("amendment", partnerTier)
      : { evCut: 5000, partnerCut: 0 };

    const { data: order, error: orderError } = await supabase.from("orders").insert({
      client_id: client.id,
      product_type: "amendment",
      status: "pending",
      amount_total: 5000,
      ev_cut: evCut,
      partner_cut: partnerCut,
      partner_id: partnerId,
      amendment_type: "paid",
      acknowledgment_signed: true,
      acknowledgment_signed_at: new Date().toISOString(),
    }).select("id").single();

    if (orderError || !order) return NextResponse.json({ error: "Failed to create order" }, { status: 500 });

    await supabase.from("quiz_sessions").insert({ client_id: client.id, answers: { changeType, description }, recommendation: "will", completed: true });

    const origin = request.headers.get("origin") || "https://www.estatevault.us";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price_data: { currency: "usd", product_data: { name: "Document Amendment", description: `${changeType}: ${description.substring(0, 100)}` }, unit_amount: 5000 }, quantity: 1 }],
      success_url: `${origin}/dashboard/documents?amended=true`,
      cancel_url: `${origin}/dashboard/amendment`,
      metadata: { order_id: order.id, client_id: client.id, product_type: "amendment", attorney_review: "false", partner_id: partnerId || "" },
    });

    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Amendment checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
