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
          subject: "Your Trust Package is ready",
          html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1C3557;padding:24px 32px;border-radius:12px 12px 0 0;"><h1 style="color:white;font-size:20px;margin:0;">EstateVault</h1></div>
            <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <h2 style="color:#1C3557;font-size:22px;">Your Trust Package is ready.</h2>
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
              <p style="color:#666;font-size:14px;line-height:1.8;">&#10003; Revocable Living Trust<br/>&#10003; Pour-Over Will<br/>&#10003; Durable Power of Attorney<br/>&#10003; Healthcare Directive<br/>&#10003; Asset Funding Checklist</p>
              <p style="color:#999;font-size:12px;margin-top:24px;">This platform provides document preparation services only. It does not provide legal advice.</p>
            </div>
          </div>`,
        });
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

    const origin = request.headers.get("origin") || "https://www.estatevault.us";

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
