import { NextResponse } from "next/server";
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
/*  POST /api/professionals/request-access                            */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      professionalType,
      clientCount,
      referralSource,
      bar_number,
      practice_areas,
      desired_review_fee,
    } = body;

    // Basic validation
    if (!firstName || !lastName || !email || !professionalType) {
      return NextResponse.json(
        { error: "First name, last name, email, and professional type are required." },
        { status: 400 }
      );
    }

    // Save to Supabase
    const supabase = getSupabaseAdmin();

    const { error: dbError } = await supabase
      .from("professional_leads")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        company_name: companyName || null,
        professional_type: professionalType,
        client_count: clientCount || null,
        referral_source: referralSource || null,
        bar_number: bar_number || null,
        practice_areas: practice_areas || null,
        desired_review_fee: desired_review_fee || null,
        status: "new",
      });

    if (dbError) {
      console.error("Failed to save professional lead:", dbError);
      return NextResponse.json(
        { error: "Failed to save your request. Please try again." },
        { status: 500 }
      );
    }

    // Send notification email to sales team (non-blocking)
    try {
      const resendKey = process.env.RESEND_API_KEY;
      const notifyEmail = process.env.SALES_NOTIFICATION_EMAIL;

      if (resendKey && notifyEmail) {
        const resend = new Resend(resendKey);

        await resend.emails.send({
          from: "EstateVault <noreply@estatevault.us>",
          to: notifyEmail,
          subject: `New Partner Lead: ${firstName} ${lastName} (${professionalType})`,
          html: `
            <h2>New Professional Partner Lead</h2>
            <table style="border-collapse:collapse;">
              <tr><td style="padding:4px 12px;font-weight:600;">Name</td><td style="padding:4px 12px;">${firstName} ${lastName}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Email</td><td style="padding:4px 12px;">${email}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Phone</td><td style="padding:4px 12px;">${phone || "N/A"}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Company</td><td style="padding:4px 12px;">${companyName || "N/A"}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Type</td><td style="padding:4px 12px;">${professionalType}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Clients</td><td style="padding:4px 12px;">${clientCount || "N/A"}</td></tr>
              <tr><td style="padding:4px 12px;font-weight:600;">Referral</td><td style="padding:4px 12px;">${referralSource || "N/A"}</td></tr>
            </table>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send sales notification email:", emailErr);
    }

    // Send confirmation email to the professional (non-blocking)
    try {
      const resendKey = process.env.RESEND_API_KEY;

      if (resendKey && email) {
        const resend = new Resend(resendKey);

        await resend.emails.send({
          from: "EstateVault <noreply@estatevault.us>",
          to: email,
          subject: "We received your EstateVault Pro request",
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
                  <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Thanks, ${firstName}!</h2>
                  <p style="font-size:14px;color:#2D2D2D;line-height:1.6;">
                    We received your request to join the EstateVault Pro partner program.
                    A member of our partnerships team will reach out within one business day
                    to discuss next steps.
                  </p>
                  <p style="margin-top:24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
                    In the meantime, if you have any questions, feel free to reply to this email.
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
      console.error("Failed to send confirmation email:", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Request access error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
