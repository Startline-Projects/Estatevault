import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAuth } from "@/lib/api/auth";

export async function POST() {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { data: partner } = await auth.admin
    .from("partners")
    .select("id, resend_domain_id")
    .eq("profile_id", auth.profile.id)
    .single();
  if (!partner) return NextResponse.json({ error: "partner not found" }, { status: 404 });

  if (partner.resend_domain_id) {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    try { await resend.domains.remove(partner.resend_domain_id); } catch {}
  }

  await auth.admin.from("partners").update({
    resend_domain_id: null,
    sender_domain: null,
    dns_records: null,
    email_verified: false,
    email_verified_at: null,
    last_verify_check_at: null,
  }).eq("id", partner.id);

  return NextResponse.json({ ok: true });
}
