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

const VALID_PROMO_CODES: Record<string, boolean> = {
  TPFP: true,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      tier,
      email,
      name,
      first_name,
      last_name,
      firm_name,
      bar_number,
      review_fee,
      practice_area,
      years_in_practice,
      phone,
      password,
      promo_code,
    } = body;

    if (!email || !name || !bar_number || !tier) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const isPromoFree = promo_code && VALID_PROMO_CODES[promo_code.toUpperCase()];

    // If promo code makes it free, skip Stripe, create account directly
    if (isPromoFree) {
      const supabase = createAdminClient();

      // Create auth user
      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: password || undefined,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          user_type: "partner",
        },
      });

      if (authError || !newUser.user) {
        console.error("Failed to create user:", authError);
        return NextResponse.json(
          { error: authError?.message || "Failed to create account." },
          { status: 500 }
        );
      }

      // Create profile
      await supabase.from("profiles").upsert({
        id: newUser.user.id,
        email,
        full_name: name,
        phone: phone || null,
        user_type: "partner",
      });

      // Create partner record
      const partnerSlug = (firm_name || name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      await supabase.from("partners").insert({
        profile_id: newUser.user.id,
        company_name: firm_name || name,
        tier: tier === "professional" ? "enterprise" : "standard",
        status: "pending_verification",
        professional_type: "attorney",
        bar_number: bar_number || null,
        custom_review_fee: (review_fee || 300) * 100,
        practice_areas: practice_area ? [practice_area] : [],
        partner_slug: partnerSlug,
        one_time_fee_paid: true,
        one_time_fee_amount: 0,
        product_name: "Legacy Protection",
      });

      // Log to audit
      await supabase.from("audit_log").insert({
        actor_id: newUser.user.id,
        action: "attorney.signup_promo",
        resource_type: "partner",
        metadata: {
          tier,
          promo_code: promo_code.toUpperCase(),
          bar_number,
          review_fee,
        },
      });

      // Send notification email (don't block on failure)
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const salesEmail = process.env.SALES_NOTIFICATION_EMAIL || "info@estatevault.us";

        await resend.emails.send({
          from: "EstateVault <info@estatevault.us>",
          to: salesEmail,
          subject: `New Attorney Partner (PROMO), Bar Verification Needed, ${firm_name || name}`,
          html: `<p><strong>New attorney partner signed up with promo code ${promo_code.toUpperCase()}</strong></p>
            <p>Name: ${name}<br>Email: ${email}<br>Phone: ${phone || "N/A"}<br>
            Firm: ${firm_name || "N/A"}<br>Bar Number: ${bar_number}<br>
            Tier: ${tier}<br>Review Fee: $${review_fee || 300}<br>
            Practice Area: ${practice_area || "N/A"}</p>
            <p>Please verify bar number at michbar.org and activate account.</p>`,
        });
      } catch (emailErr) {
        console.error("Notification email failed:", emailErr);
      }

      const origin = request.headers.get("origin") || "https://www.estatevault.us";
      return NextResponse.json({
        redirect: `${origin}/partners/attorneys/welcome?promo=TPFP&tier=${tier}`,
      });
    }

    // Normal paid flow, create Stripe checkout session
    const amount = tier === "professional" ? 600000 : 120000;
    const planName = tier === "professional" ? "Professional" : "Standard";
    const origin = request.headers.get("origin") || "https://www.estatevault.us";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `EstateVault Attorney Partner, ${planName}`,
              description: `One-time ${planName} attorney partner platform fee`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/partners/attorneys/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/partners/attorneys/signup?tier=${tier}`,
      metadata: {
        flow: "attorney_signup",
        tier,
        bar_number: bar_number || "",
        review_fee: String(review_fee || 300),
        firm_name: firm_name || "",
        practice_area: practice_area || "",
        years_in_practice: years_in_practice || "",
        first_name: first_name || "",
        last_name: last_name || "",
        phone: phone || "",
        name: name || "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Attorney checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
