import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, attorneyReview, intakeAnswers, complexityFlag, complexityReasons, declinedAttorneyReview } = body;

    if (!userId || !intakeAnswers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authClient = createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get or create client
    let clientId: string;
    const { data: existingClient } = await supabase.from("clients").select("id").eq("profile_id", userId).single();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({ profile_id: userId, source: "direct", state: "Michigan" })
        .select("id")
        .single();

      if (clientError || !newClient) {
        console.error("Client creation error:", clientError);
        return NextResponse.json({ error: "Failed to create client record: " + (clientError?.message || "unknown") }, { status: 500 });
      }
      clientId = newClient.id;
    }

    const trustAmount = 60000; // $600
    const attorneyAmount = attorneyReview ? 30000 : 0;
    const totalAmount = trustAmount + attorneyAmount;
    const evCut = 20000; // EstateVault keeps $200 from trust

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        client_id: clientId,
        product_type: "trust",
        status: "pending",
        amount_total: totalAmount,
        ev_cut: evCut,
        partner_cut: 0,
        attorney_review_requested: attorneyReview,
        attorney_cut: attorneyAmount,
        complexity_flag: complexityFlag || false,
        complexity_flag_reason: complexityReasons?.join("; ") || null,
        acknowledgment_signed: true,
        acknowledgment_signed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Order creation error:", orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    // Save intake
    await supabase.from("quiz_sessions").insert({
      client_id: clientId,
      answers: { ...intakeAnswers, declinedAttorneyReview },
      recommendation: "trust",
      completed: true,
    });

    const lineItems: Array<{
      price_data: { currency: string; product_data: { name: string; description?: string }; unit_amount: number };
      quantity: number;
    }> = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Trust Package",
            description: "Revocable Living Trust, Pour-Over Will, Power of Attorney, Healthcare Directive, Asset Funding Checklist, Family Vault Access",
          },
          unit_amount: trustAmount,
        },
        quantity: 1,
      },
    ];

    if (attorneyReview) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Attorney Review",
            description: "Licensed Michigan attorney review of your trust documents (48hr turnaround)",
          },
          unit_amount: attorneyAmount,
        },
        quantity: 1,
      });
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${origin}/trust/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/trust/checkout`,
      metadata: {
        order_id: order.id,
        client_id: clientId,
        product_type: "trust",
        attorney_review: attorneyReview ? "true" : "false",
      },
    });

    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "checkout.started",
      resource_type: "order",
      resource_id: order.id,
      metadata: { product_type: "trust", attorney_review: attorneyReview, complexity_flag: complexityFlag },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
