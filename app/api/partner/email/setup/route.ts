import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAuth } from "@/lib/api/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { sender_name, sender_email } = await req.json();
  if (!sender_name || !sender_email) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const domain = String(sender_email).split("@")[1]?.toLowerCase().trim();
  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const { data: partner } = await auth.admin
    .from("partners")
    .select("id, resend_domain_id, sender_domain")
    .eq("profile_id", auth.profile.id)
    .single();
  if (!partner) return NextResponse.json({ error: "partner not found" }, { status: 404 });

  const resend = new Resend(process.env.RESEND_API_KEY!);
  let domainId = partner.resend_domain_id as string | null;
  let dnsRecords: unknown = null;

  // If domain changed, delete old one
  if (domainId && partner.sender_domain && partner.sender_domain !== domain) {
    try { await resend.domains.remove(domainId); } catch {}
    domainId = null;
  }

  if (!domainId) {
    const created = await resend.domains.create({ name: domain });
    if (created.error || !created.data) {
      return NextResponse.json({ error: created.error?.message || "domain create failed" }, { status: 400 });
    }
    domainId = created.data.id;
    dnsRecords = (created.data as { records?: unknown }).records ?? null;
  } else {
    const got = await resend.domains.get(domainId);
    dnsRecords = (got.data as { records?: unknown } | null)?.records ?? null;
  }

  await auth.admin.from("partners").update({
    sender_name,
    sender_email,
    sender_domain: domain,
    resend_domain_id: domainId,
    dns_records: dnsRecords,
    email_verified: false,
    email_verified_at: null,
  }).eq("id", partner.id);

  return NextResponse.json({ ok: true, domain_id: domainId, dns_records: dnsRecords });
}
