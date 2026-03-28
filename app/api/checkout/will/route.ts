import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, attorneyReview, intakeAnswers } = body;

    if (!intakeAnswers) {
      return NextResponse.json(
        { error: "Missing intake answers" },
        { status: 400 }
      );
    }

    // Use admin client for DB operations (bypasses RLS)
    const supabase = createAdminClient();

    // Get or create client record
    let clientId: string;

    if (userId) {
      // Logged-in user — find or create their client record
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("profile_id", userId)
        .single();

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
          return NextResponse.json(
            { error: "Failed to create client record" },
            { status: 500 }
          );
        }
        clientId = newClient.id;
      }
    } else {
      // Anonymous user — create client record without profile_id
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({ source: "direct", state: "Michigan" })
        .select("id")
        .single();

      if (clientError || !newClient) {
        console.error("Anonymous client creation error:", clientError);
        return NextResponse.json(
          { error: "Failed to create client record" },
          { status: 500 }
        );
      }
      clientId = newClient.id;
    }

    // Calculate amounts (in cents)
    const willAmount = 40000; // $400
    const attorneyAmount = attorneyReview ? 30000 : 0; // $300
    const totalAmount = willAmount + attorneyAmount;
    const evCut = 10000; // EstateVault keeps $100 from will
    const partnerCut = 0; // Direct sale — no partner

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        client_id: clientId,
        product_type: "will",
        status: "pending",
        amount_total: totalAmount,
        ev_cut: evCut,
        partner_cut: partnerCut,
        attorney_review_requested: attorneyReview,
        attorney_cut: attorneyAmount,
        acknowledgment_signed: true,
        acknowledgment_signed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    // Save intake answers to quiz_sessions for record keeping
    await supabase.from("quiz_sessions").insert({
      client_id: clientId,
      answers: intakeAnswers,
      recommendation: "will",
      completed: true,
    });

    // Build Stripe line items
    const lineItems: Array<{
      price_data: {
        currency: string;
        product_data: { name: string; description?: string };
        unit_amount: number;
      };
      quantity: number;
    }> = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Will Package",
            description:
              "Last Will & Testament, Power of Attorney, Healthcare Directive, Execution Guide, Family Vault Access",
          },
          unit_amount: willAmount,
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
            description:
              "Licensed Michigan attorney review of your documents (48hr turnaround)",
          },
          unit_amount: attorneyAmount,
        },
        quantity: 1,
      });
    }

    // Create Stripe Checkout Session
    const origin = request.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${origin}/will/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/will/checkout`,
      metadata: {
        order_id: order.id,
        client_id: clientId,
        product_type: "will",
        attorney_review: attorneyReview ? "true" : "false",
      },
    });

    // Update order with Stripe session ID
    await supabase
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    // Audit log
    await supabase.from("audit_log").insert({
      actor_id: userId || null,
      action: "checkout.started",
      resource_type: "order",
      resource_id: order.id,
      metadata: { product_type: "will", attorney_review: attorneyReview },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
