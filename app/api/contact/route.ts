import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
