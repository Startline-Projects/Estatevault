import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAuth, rateLimit } from "@/lib/api/auth";

export async function POST() {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  if (!rateLimit(`test-email:${auth.profile.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const { data: partner } = await auth.admin
    .from("partners")
    .select("id, sender_name, sender_email, email_verified, company_name")
    .eq("profile_id", auth.profile.id)
    .single();
  if (!partner) return NextResponse.json({ error: "partner not found" }, { status: 404 });
  if (!partner.email_verified || !partner.sender_email) {
    return NextResponse.json({ error: "domain not verified" }, { status: 400 });
  }
  if (!auth.user.email) {
    return NextResponse.json({ error: "no recipient" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const from = `${partner.sender_name || partner.company_name} <${partner.sender_email}>`;
  const sent = await resend.emails.send({
    from,
    to: auth.user.email,
    replyTo: partner.sender_email,
    subject: `Test email from ${partner.sender_name || partner.company_name}`,
    html: `<p>This is a test email from your white-label sender address.</p><p>From: ${from}</p>`,
  });
  if (sent.error) {
    return NextResponse.json({ error: sent.error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
