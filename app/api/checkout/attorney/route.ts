import { NextResponse } from "next/server";
import { getResend } from "@/lib/email";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import { attorneyCheckoutSchema } from "@/lib/validation/schemas";
import { PROMO_CODES, PARTNER_PLATFORM_FEE, DEFAULT_ATTORNEY_REVIEW_FEE } from "@/lib/orders/pricing";

export const POST = withRoute(async (request: Request) => {
  try {
    const body = await request.json();
    const parsed = attorneyCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing required fields.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      tier,
      email,
      name,
      first_name,
      last_name,
      firm_name,
      bar_number,
      practice_area,
      years_in_practice,
      phone,
      password,
      promo_code,
    } = parsed.data;

    const isPromoFree = promo_code && promo_code.toUpperCase() in PROMO_CODES;

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
      await profileRepo.upsert(supabase, {
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

      await partnerRepo.insert(supabase, {
        profile_id: newUser.user.id,
        company_name: firm_name || name,
        tier: tier === "professional" ? "enterprise" : "standard",
        status: "pending_verification",
        professional_type: "attorney",
        bar_number: bar_number || null,
        // Fee is admin-controlled (BUG-4): seed the platform default; only Admin
        // can change it later per-partner. Partners cannot set their own fee.
        custom_review_fee: DEFAULT_ATTORNEY_REVIEW_FEE,
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
        },
      });

      // Send notification email (don't block on failure)
      try {
        const resend = getResend();
        const salesEmail = process.env.SALES_NOTIFICATION_EMAIL || "info@estatevault.us";

        await resend.emails.send({
          from: "EstateVault <info@estatevault.us>",
          to: salesEmail,
          subject: `New Attorney Partner (PROMO), Bar Verification Needed, ${firm_name || name}`,
          html: `<p><strong>New attorney partner signed up with promo code ${promo_code.toUpperCase()}</strong></p>
            <p>Name: ${name}<br>Email: ${email}<br>Phone: ${phone || "N/A"}<br>
            Firm: ${firm_name || "N/A"}<br>Bar Number: ${bar_number}<br>
            Tier: ${tier}<br>Review Fee: $${DEFAULT_ATTORNEY_REVIEW_FEE / 100} (admin-controlled)<br>
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

    const amount = tier === "professional" ? PARTNER_PLATFORM_FEE.enterprise : PARTNER_PLATFORM_FEE.standard;
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
});
