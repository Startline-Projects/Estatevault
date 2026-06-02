import { NextRequest } from "next/server";
import { getResend } from "@/lib/email";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { partnerEmailSetupSchema } from "@/lib/validation/schemas";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import type { Json } from "@/types/db.generated";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = partnerEmailSetupSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { sender_name, sender_email } = parsed.data;

  const domain = String(sender_email).split("@")[1]?.toLowerCase().trim();
  if (!domain || !domain.includes(".")) return fail("invalid email", 400);

  const { data: partner } = await partnerRepo.getEmailSettingsByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("partner not found", 404);

  const resend = getResend();
  let domainId = partner.resend_domain_id as string | null;
  let dnsRecords: Json = null;

  if (domainId && partner.sender_domain && partner.sender_domain !== domain) {
    try { await resend.domains.remove(domainId); } catch {}
    domainId = null;
  }

  if (!domainId) {
    const created = await resend.domains.create({ name: domain });
    if (created.error || !created.data) {
      console.error("[partner/email/setup] domain create failed:", created.error);
      return fail("domain create failed", 400);
    }
    domainId = created.data.id;
    dnsRecords = ((created.data as { records?: unknown }).records ?? null) as Json;
  } else {
    const got = await resend.domains.get(domainId);
    dnsRecords = (((got.data as { records?: unknown } | null)?.records) ?? null) as Json;
  }

  await partnerRepo.update(auth.admin, partner.id, {
    sender_name,
    sender_email,
    sender_domain: domain,
    resend_domain_id: domainId,
    dns_records: dnsRecords,
    email_verified: false,
    email_verified_at: null,
  });

  return ok({ ok: true, domain_id: domainId, dns_records: dnsRecords });
});
