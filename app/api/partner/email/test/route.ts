import { NextRequest } from "next/server";
import { getResend } from "@/lib/email";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { apiRateLimit } from "@/lib/rate-limit";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

export const POST = withRoute(async (_req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { success: rlOk } = await apiRateLimit.limit(`test-email:${auth.profile.id}`);
  if (!rlOk) return fail("rate limited", 429);

  const { data: partner } = await partnerRepo.getEmailSettingsByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("partner not found", 404);
  if (!partner.email_verified || !partner.sender_email) return fail("domain not verified", 400);
  if (!auth.user.email) return fail("no recipient", 400);

  const resend = getResend();
  const from = `${partner.sender_name || partner.company_name} <${partner.sender_email}>`;
  const sent = await resend.emails.send({
    from,
    to: auth.user.email,
    replyTo: partner.sender_email,
    subject: `Test email from ${partner.sender_name || partner.company_name}`,
    html: `<p>This is a test email from your white-label sender address.</p><p>From: ${from}</p>`,
  });
  if (sent.error) return fail("send failed", 400);

  return ok({ ok: true });
});
