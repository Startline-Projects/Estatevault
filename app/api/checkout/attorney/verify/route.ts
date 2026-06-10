import { NextResponse } from "next/server";
import { getResend } from "@/lib/email";
import { stripe } from "@/lib/stripe";
import { withRoute } from "@/lib/api/route";
import { createAdminClient } from "@/lib/api/auth";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import { attorneyVerifySchema } from "@/lib/validation/schemas";
import { DEFAULT_ATTORNEY_REVIEW_FEE } from "@/lib/orders/pricing";

/* ------------------------------------------------------------------ */
/*  POST /api/checkout/attorney/verify                                */
/* ------------------------------------------------------------------ */

export const POST = withRoute(async (request: Request) => {
  try {
    const body = await request.json();
    const parsed = attorneyVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }
    const sessionId = parsed.data.session_id;
    const clientPassword = parsed.data.password || "";

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
    const password = clientPassword || "";
    const tier = meta.tier || "standard";
    const barNumber = meta.bar_number || "";
    const firmName = meta.firm_name || "";
    const practiceArea = meta.practice_area || "";
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

    const supabase = createAdminClient();

    // ── Idempotency / replay safety (BUG-16) ──────────────────────────
    // This endpoint is unauthenticated by necessity — it runs before the
    // attorney has an account — and is keyed on a session_id that appears
    // verbatim in the success URL, so anyone who sees it can replay it.
    // Defense is idempotency: resolve the account by email and make every
    // mutation below run at most once. A replay must never (a) write a
    // body-supplied password onto an existing account, nor (b) reset an
    // existing partner's admin-tuned tier/fee/status back to signup values.

    // 2. Resolve the auth user — reuse if one already exists for this email
    //    (mirrors the find_auth_user_by_email lookup in handleDocumentCheckout).
    let userId: string | undefined;
    const { data: existingAuthUser } = await supabase
      .rpc("find_auth_user_by_email", { lookup_email: email })
      .returns<{ id: string; email: string }[]>()
      .maybeSingle();

    if (existingAuthUser) {
      // Existing account → do NOT createUser; that path would let a replayed,
      // body-supplied password reach an account the caller may not own.
      userId = existingAuthUser.id;
    } else {
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
        console.error("[attorney/verify] auth user creation error:", authError);
        if (authError.message?.includes("already been registered")) {
          // Lost a race with a concurrent replay (user created between our
          // lookup and now). Re-resolve instead of failing — still no password.
          const { data: raced } = await supabase
            .rpc("find_auth_user_by_email", { lookup_email: email })
            .returns<{ id: string; email: string }[]>()
            .maybeSingle();
          userId = raced?.id;
        } else {
          return NextResponse.json(
            { error: "Failed to create user account." },
            { status: 500 }
          );
        }
      } else {
        userId = authData?.user?.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Failed to resolve user account." },
        { status: 500 }
      );
    }

    // 3. Create profile (upsert keyed on id → naturally idempotent on replay)
    const fullName = `${firstName} ${lastName}`.trim();
    const { error: profileErr } = await profileRepo.upsert(supabase, {
      id: userId,
      full_name: fullName,
      email,
      phone: phone || null,
      user_type: "partner",
    });
    if (profileErr) {
      console.error("[attorney/verify] profiles upsert failed", profileErr);
      return NextResponse.json(
        { error: "Failed to create profile." },
        { status: 500 }
      );
    }

    // 4. Create partner record — the core replay guard. If a partner already
    //    exists for this account, leave it untouched: a replay must not reset
    //    custom_review_fee/tier/status to signup values (BUG-16). Field shape
    //    is the C-8 fix (see tests/unit/attorney-verify-c8.test.ts):
    //   - profile_id (not user_id); tier normalized to standard|enterprise
    //   - custom_review_fee + one_time_fee_amount are integer-cents columns
    //   - practice_areas is text[]; no years_in_practice / stripe_session_id cols
    let partnerCreated = false;
    const { data: existingPartner } = await partnerRepo.getByProfileId(supabase, userId);
    if (!existingPartner) {
      const normalizedTier = tier === "professional" ? "enterprise" : "standard";
      const { error: partnerErr } = await partnerRepo.upsert(supabase, {
        profile_id: userId,
        company_name: firmName || `${firstName} ${lastName} Law`,
        professional_type: "attorney",
        tier: normalizedTier,
        status: "pending_verification",
        // Admin-controlled fee (BUG-4): seed platform default; partners can't set it.
        custom_review_fee: DEFAULT_ATTORNEY_REVIEW_FEE,
        bar_number: barNumber,
        practice_areas: practiceArea ? [practiceArea] : [],
        one_time_fee_paid: true,
        one_time_fee_amount: session.amount_total ?? 0,
      });
      if (partnerErr) {
        console.error("[attorney/verify] partners upsert failed", partnerErr);
        return NextResponse.json(
          { error: "Failed to create partner record." },
          { status: 500 }
        );
      }
      partnerCreated = true;
    }

    // 5. Send welcome email via Resend (non-blocking) — first creation only,
    //    so a replay (BUG-16) never re-emails the attorney.
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey && email && partnerCreated) {
        const resend = getResend();
        await resend.emails.send({
          from: "EstateVault <info@estatevault.us>",
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
                    If you have any questions, reply to this email or contact us at info@estatevault.us.
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

    // 6. Send internal notification to sales team (non-blocking) — first
    //    creation only; a replay (BUG-16) must not re-notify sales.
    try {
      const resendKey = process.env.RESEND_API_KEY;
      const notifyEmail = process.env.SALES_NOTIFICATION_EMAIL;

      if (resendKey && notifyEmail && partnerCreated) {
        const resend = getResend();
        await resend.emails.send({
          from: "EstateVault <info@estatevault.us>",
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
              <tr><td style="padding:4px 12px;font-weight:600;">Review Fee</td><td style="padding:4px 12px;">$${DEFAULT_ATTORNEY_REVIEW_FEE / 100} (admin-controlled)</td></tr>
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
});
