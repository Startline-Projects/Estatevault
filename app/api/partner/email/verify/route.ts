import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAuth, rateLimit } from "@/lib/api/auth";

export async function POST() {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  if (!rateLimit(`verify:${auth.profile.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const { data: partner } = await auth.admin
    .from("partners")
    .select("id, resend_domain_id")
    .eq("profile_id", auth.profile.id)
    .single();
  if (!partner?.resend_domain_id) {
    return NextResponse.json({ error: "no domain configured" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  try { await resend.domains.verify(partner.resend_domain_id); } catch {}
  const got = await resend.domains.get(partner.resend_domain_id);
  if (got.error || !got.data) {
    return NextResponse.json({ error: got.error?.message || "lookup failed" }, { status: 400 });
  }

  const status = (got.data as { status?: string }).status;
  const verified = status === "verified";
  const records = (got.data as { records?: unknown }).records ?? null;

  await auth.admin.from("partners").update({
    email_verified: verified,
    email_verified_at: verified ? new Date().toISOString() : null,
    last_verify_check_at: new Date().toISOString(),
    dns_records: records,
  }).eq("id", partner.id);

  return NextResponse.json({ ok: true, verified, status, dns_records: records });
}
