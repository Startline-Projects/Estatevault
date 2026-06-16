import { NextRequest, NextResponse } from "next/server";
import { getResend, escapeHtml } from "@/lib/email";
import { contactSchema } from "@/lib/validation/schemas";

const resend = getResend();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    const { name, email, message } = parsed.data;

    const escape = escapeHtml;

    await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: "info@estatevault.us",
      replyTo: email,
      subject: `New contact form message from ${name}`,
      html: `
        <div style="font-family:Inter,sans-serif;color:#2D2D2D;">
          <h2 style="color:#1C3557;">New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${escape(name)}</p>
          <p><strong>Email:</strong> ${escape(email)}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space:pre-wrap;">${escape(message)}</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Contact form send failed:", e);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
