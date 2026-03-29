import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

/* ------------------------------------------------------------------ */
/*  Supabase admin client (bypasses RLS)                              */
/* ------------------------------------------------------------------ */

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, serviceKey);
}

/* ------------------------------------------------------------------ */
/*  POST /api/checkout/attorney/verify                                */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = body.session_id;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    // 1. Verify Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    const meta = session.metadata || {};

    if (meta.flow !== "attorney_signup") {
      return NextResponse.json(
        { error: "Invalid session type" },
        { status: 400 }
      );
    }

    const email = session.customer_email || "";
    const password = meta.password || "";
    const tier = meta.tier || "standard";
    const barNumber = meta.bar_number || "";
    const reviewFee = parseInt(meta.review_fee || "300", 10);
    const firmName = meta.firm_name || "";
    const practiceArea = meta.practice_area || "";
    const yearsInPractice = meta.years_in_practice || "";
    const firstName = meta.first_name || "";
    const lastName = meta.last_name || "";
    const phone = meta.phone || "";
    const amount = session.amount_total ? session.amount_total / 100 : 0;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing account credentials in session metadata" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 2. Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        user_type: "partner",
      },
    });

    if (authError) {
      console.error("Auth user creation error:", authError);
      // If user already exists, that might be a retry — don't fail hard
      if (!authError.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "Failed to create user account." },
          { status: 500 }
        );
      }
    }

    const userId = authData?.user?.id;

    // 3. Create profile
    if (userId) {
      await supabase.from("profiles").upsert({
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        user_type: "partner",
      });

      // 4. Create partner record
      await supabase.from("partners").upsert({
        user_id: userId,
        company_name: firmName || `${firstName} ${lastName} Law`,
        professional_type: "attorney",
        tier,
        status: "pending_verification",
        custom_review_fee: reviewFee,
        bar_number: barNumber,
        practice_area: practiceArea,
        years_in_practice: yearsInPractice,
        one_time_fee_paid: true,
        one_time_fee_amount: amount,
        stripe_session_id: session.id,
      });
    }

    // 5. Send welcome email via Resend (non-blocking)
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey && email) {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: "EstateVault <noreply@estatevault.us>",
          to: email,
          subject: "Welcome to EstateVault Attorney Partner Program",
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
              <div style="max-width:600px;margin:0 auto;background:#ffffff;">
                <div style="background:#1C3557;padding:24px 32px;">
                  <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">EstateVault</h1>
                </div>
                <div style="padding:32px;">
                  <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Welcome, ${firstName}!</h2>
                  <p style="font-size:14px;color:#2D2D2D;line-height:1.6;">
                    Your payment has been confirmed and your ${tier === "professional" ? "Professional" : "Standard"} attorney partner account has been created.
                  </p>
                  <p style="font-size:14px;color:#2D2D2D;line-height:1.6;">
                    <strong>What happens next:</strong>
                  </p>
                  <ul style="font-size:14px;color:#2D2D2D;line-height:1.8;">
                    <li>We are verifying your bar number (${barNumber}) with the State Bar of Michigan</li>
                    <li>This typically takes 24-48 hours</li>
                    <li>Once verified, your platform will be fully activated</li>
                  </ul>
                  <p style="margin-top:24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
                    If you have any questions, reply to this email or contact us at support@estatevault.us.
                  </p>
                </div>
                <div style="background:#f8f9fa;padding:24px 32px;border-top:1px solid #e5e5e5;">
                  <p style="margin:0;font-size:13px;color:#1C3557;font-weight:600;">EstateVault</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#999;">Protect Everything That Matters</p>
                </div>
              </div>
            </body>
            </html>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send welcome email:", emailErr);
    }

    // 6. Send internal notification to sales team (non-blocking)
    try {
      const resendKey = process.env.RESEND_API_KEY;
      const notifyEmail = process.env.SALES_NOTIFICATION_EMAIL;

      if (resendKey && notifyEmail) {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: "EstateVault <noreply@estatevault.us>",
          to: notifyEmail,
          subject: `New Attorney Partner Signup: ${firstName} ${lastName} (${tier})`,
          html: `
            <h2>New Attorney Partner Signup</h2>
            <table style="border-collapse:collapse;">
              <tr><td style="padding:4px 12px;font-weight:600;">Name</td><td style="padding:4px 12px;">${firstName} ${lastName}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Email</td><td style="padding:4px 12px;">${email}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Phone</td><td style="padding:4px 12px;">${phone || "N/A"}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Firm</td><td style="padding:4px 12px;">${firmName || "N/A"}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Tier</td><td style="padding:4px 12px;">${tier}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Bar #</td><td style="padding:4px 12px;">${barNumber}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Review Fee</td><td style="padding:4px 12px;">$${reviewFee}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Amount Paid</td><td style="padding:4px 12px;">$${amount}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Practice Area</td><td style="padding:4px 12px;">${practiceArea || "N/A"}</td></tr>
            </table>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send sales notification:", emailErr);
    }

    return NextResponse.json({
      success: true,
      tier,
      amount,
    });
  } catch (err) {
    console.error("Attorney verify error:", err);
    return NextResponse.json(
      { error: "Failed to verify payment and create account." },
      { status: 500 }
    );
  }
}
