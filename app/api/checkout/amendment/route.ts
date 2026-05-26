import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { calculateSplit } from "@/lib/stripe-payouts";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as quizSessionRepo from "@/lib/repos/server/quizSessionRepo";

export const POST = withRoute(async (request: Request) => {
  try {
    const { userId, changeType, description } = await request.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const authClient = createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user || user.id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminClient();
    const { data: client } = await clientRepo.findWithPartnerByProfile(supabase, userId);
    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    // Look up partner tier if this client came through a partner
    let partnerId: string | null = client.partner_id || null;
    let partnerTier: "standard" | "enterprise" = "standard";
    if (partnerId) {
      const { data: partner } = await partnerRepo.getTier(supabase, partnerId);
      if (partner?.tier) partnerTier = partner.tier as "standard" | "enterprise";
    }

    const isSubscriber = client.vault_subscription_status === "active";

    if (isSubscriber) {
      // Free amendment for active subscribers, bypass Stripe
      const { data: order, error: orderError } = await orderRepo.insert(supabase, {
        client_id: client.id,
        product_type: "amendment",
        status: "generating",
        amount_total: 0,
        ev_cut: 0,
        amendment_type: "subscription_included",
        acknowledgment_signed: true,
        acknowledgment_signed_at: new Date().toISOString(),
      });

      if (orderError || !order) return NextResponse.json({ error: "Failed to create order" }, { status: 500 });

      await quizSessionRepo.insert(supabase, {
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

    const { data: order, error: orderError } = await orderRepo.insert(supabase, {
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
    });

    if (orderError || !order) return NextResponse.json({ error: "Failed to create order" }, { status: 500 });

    await quizSessionRepo.insert(supabase, { client_id: client.id, answers: { changeType, description }, recommendation: "will", completed: true });

    const origin = request.headers.get("origin") || "https://www.estatevault.us";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price_data: { currency: "usd", product_data: { name: "Document Amendment", description: `${changeType}: ${description.substring(0, 100)}` }, unit_amount: 5000 }, quantity: 1 }],
      success_url: `${origin}/dashboard/documents?amended=true`,
      cancel_url: `${origin}/dashboard/amendment`,
      metadata: { order_id: order.id, client_id: client.id, product_type: "amendment", attorney_review: "false", partner_id: partnerId || "" },
    });

    await orderRepo.update(supabase, order.id, { stripe_session_id: session.id });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Amendment checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
});
