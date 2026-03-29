import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
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
    const { userId, attorneyReview, intakeAnswers, complexityFlag, complexityReasons, declinedAttorneyReview, promoCode, email: promoEmail } = body;

    if (!intakeAnswers) {
      return NextResponse.json({ error: "Missing intake answers" }, { status: 400 });
    }

    const VALID_PROMO_CODES: Record<string, boolean> = { FREE134: true };
    const isPromoFree = promoCode && VALID_PROMO_CODES[promoCode.toUpperCase()];

    const supabase = createAdminClient();

    // Get or create client
    let clientId: string;

    if (userId) {
      // Logged-in user — find or create their client record
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
          return NextResponse.json({ error: "Failed to create client record" }, { status: 500 });
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
        return NextResponse.json({ error: "Failed to create client record" }, { status: 500 });
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

    // ── PROMO CODE: Free Trust ──────────────────────────────
    if (isPromoFree) {
      const emailAddr = promoEmail || intakeAnswers.email;
      if (!emailAddr) {
        return NextResponse.json({ error: "Email is required for promo orders" }, { status: 400 });
      }

      await supabase.from("orders").update({
        amount_total: 0, ev_cut: 0, partner_cut: 0, attorney_cut: 0,
        status: "generating",
        attorney_review_requested: false,
      }).eq("id", order.id);

      let profileId = userId;
      if (!profileId) {
        const { data: existingUser } = await supabase.from("profiles").select("id").eq("email", emailAddr).single();
        if (existingUser) {
          profileId = existingUser.id;
        } else {
          const { data: newUser } = await supabase.auth.admin.createUser({
            email: emailAddr,
            email_confirm: true,
            user_metadata: { full_name: `${intakeAnswers.firstName || ""} ${intakeAnswers.lastName || ""}`.trim(), user_type: "client" },
          });
          if (newUser?.user) {
            profileId = newUser.user.id;
            await supabase.from("profiles").upsert({
              id: newUser.user.id, email: emailAddr,
              full_name: `${intakeAnswers.firstName || ""} ${intakeAnswers.lastName || ""}`.trim(),
              user_type: "client",
            });
          }
        }
        if (profileId) {
          await supabase.from("clients").update({ profile_id: profileId }).eq("id", clientId);
        }
      }

      try {
        if (profileId) {
          const { data: linkData } = await supabase.auth.admin.generateLink({ type: "magiclink", email: emailAddr });
          const passwordLink = linkData?.properties?.action_link || "https://www.estatevault.us/auth/login";
          const { sendDocumentEmail } = await import("@/lib/email");
          await sendDocumentEmail({ to: emailAddr, productType: "trust", passwordLink });
        }
      } catch (emailErr) { console.error("Promo email failed:", emailErr); }

      const docTypes = ["trust", "pour_over_will", "poa", "healthcare_directive"];
      await supabase.from("documents").insert(docTypes.map((dt) => ({
        order_id: order.id, document_type: dt, status: "pending",
      })));

      await supabase.from("audit_log").insert({
        actor_id: profileId || null,
        action: "checkout.promo_free",
        resource_type: "order",
        resource_id: order.id,
        metadata: { product_type: "trust", promo_code: promoCode, email: emailAddr },
      });

      return NextResponse.json({ free: true, orderId: order.id, email: emailAddr });
    }

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
      actor_id: userId || null,
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
