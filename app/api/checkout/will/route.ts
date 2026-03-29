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
    const { userId, attorneyReview, intakeAnswers, promoCode, email: promoEmail } = body;

    if (!intakeAnswers) {
      return NextResponse.json(
        { error: "Missing intake answers" },
        { status: 400 }
      );
    }

    const VALID_PROMO_CODES: Record<string, boolean> = { FREE134: true };
    const isPromoFree = promoCode && VALID_PROMO_CODES[promoCode.toUpperCase()];

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

    // ── PROMO CODE: Free Will ──────────────────────────────
    if (isPromoFree) {
      const emailAddr = promoEmail || intakeAnswers.email;
      if (!emailAddr) {
        return NextResponse.json({ error: "Email is required for promo orders" }, { status: 400 });
      }

      // Update order to free + generating
      await supabase.from("orders").update({
        amount_total: 0, ev_cut: 0, partner_cut: 0, attorney_cut: 0,
        status: "generating",
        attorney_review_requested: false,
      }).eq("id", order.id);

      // Create user account with temp password
      let profileId = userId;
      const { generateTempPassword } = await import("@/lib/utils/generate-password");
      const tempPassword = generateTempPassword();

      if (!profileId) {
        const { data: existingUser } = await supabase.from("profiles").select("id").eq("email", emailAddr).single();
        if (existingUser) {
          profileId = existingUser.id;
          // Update password for existing user so temp password works
          await supabase.auth.admin.updateUserById(existingUser.id, { password: tempPassword });
        } else {
          const fullName = `${intakeAnswers.firstName || ""} ${intakeAnswers.lastName || ""}`.trim();
          const { data: newUser } = await supabase.auth.admin.createUser({
            email: emailAddr,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: fullName, user_type: "client" },
          });
          if (newUser?.user) {
            profileId = newUser.user.id;
            await supabase.from("profiles").upsert({
              id: newUser.user.id, email: emailAddr,
              full_name: fullName,
              user_type: "client",
            });
          }
        }
        if (profileId) {
          await supabase.from("clients").update({ profile_id: profileId }).eq("id", clientId);
        }
      }

      // Send document email with temp password
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "EstateVault <info@estatevault.us>",
          to: emailAddr,
          subject: "Your Will Package is ready",
          html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1C3557;padding:24px 32px;border-radius:12px 12px 0 0;"><h1 style="color:white;font-size:20px;margin:0;">EstateVault</h1></div>
            <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <h2 style="color:#1C3557;font-size:22px;">Your Will Package is ready.</h2>
              <p style="color:#2D2D2D;line-height:1.6;">Your documents have been generated and are saved in your account. Sign in below to view and download them.</p>
              <div style="background:#f8f9fa;border-radius:12px;padding:20px;margin:24px 0;">
                <p style="margin:0 0 8px;color:#666;font-size:13px;">Email</p>
                <p style="margin:0 0 16px;color:#1C3557;font-weight:600;">${emailAddr}</p>
                <p style="margin:0 0 8px;color:#666;font-size:13px;">Temporary Password</p>
                <p style="margin:0;color:#1C3557;font-weight:600;font-family:monospace;font-size:18px;">${tempPassword}</p>
              </div>
              <a href="https://www.estatevault.us/auth/login" style="display:block;text-align:center;background:#C9A84C;color:white;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:600;font-size:14px;">Sign In & View Documents</a>
              <p style="color:#999;font-size:12px;margin-top:24px;text-align:center;">Please change your password after signing in.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
              <p style="color:#2D2D2D;font-weight:600;font-size:14px;">Documents Included:</p>
              <p style="color:#666;font-size:14px;line-height:1.8;">&#10003; Last Will & Testament<br/>&#10003; Durable Power of Attorney<br/>&#10003; Healthcare Directive<br/>&#10003; Execution Guide</p>
              <p style="color:#999;font-size:12px;margin-top:24px;">This platform provides document preparation services only. It does not provide legal advice.</p>
            </div>
          </div>`,
        });
      } catch (emailErr) { console.error("Promo email failed:", emailErr); }

      // Create document records
      const docTypes = ["will", "poa", "healthcare_directive"];
      await supabase.from("documents").insert(docTypes.map((dt) => ({
        order_id: order.id, document_type: dt, status: "pending",
      })));

      // Audit log
      await supabase.from("audit_log").insert({
        actor_id: profileId || null,
        action: "checkout.promo_free",
        resource_type: "order",
        resource_id: order.id,
        metadata: { product_type: "will", promo_code: promoCode, email: emailAddr },
      });

      return NextResponse.json({ free: true, orderId: order.id, email: emailAddr });
    }

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
    const origin = request.headers.get("origin") || "https://www.estatevault.us";

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
