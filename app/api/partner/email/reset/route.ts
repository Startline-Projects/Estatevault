import { NextRequest } from "next/server";
import { getResend } from "@/lib/email";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

export const POST = withRoute(async (_req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getEmailSettingsByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("partner not found", 404);

  if (partner.resend_domain_id) {
    const resend = getResend();
    try { await resend.domains.remove(partner.resend_domain_id); } catch {}
  }

  await partnerRepo.update(auth.admin, partner.id, {
    resend_domain_id: null,
    sender_domain: null,
    dns_records: null,
    email_verified: false,
    email_verified_at: null,
    last_verify_check_at: null,
  });

  return ok({ ok: true });
});
