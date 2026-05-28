import { NextRequest } from "next/server";
import { Resend } from "resend";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { apiRateLimit } from "@/lib/rate-limit";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

export const POST = withRoute(async (_req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { success: rlOk } = await apiRateLimit.limit(`verify:${auth.profile.id}`);
  if (!rlOk) return fail("rate limited", 429);

  const { data: partner } = await partnerRepo.getEmailSettingsByProfileId(auth.admin, auth.profile.id);
  if (!partner?.resend_domain_id) return fail("no domain configured", 400);

  const resend = new Resend(process.env.RESEND_API_KEY!);
  try { await resend.domains.verify(partner.resend_domain_id); } catch {}
  const got = await resend.domains.get(partner.resend_domain_id);
  if (got.error || !got.data) return fail("lookup failed", 400);

  const status = (got.data as { status?: string }).status;
  const verified = status === "verified";
  const records = (got.data as { records?: unknown }).records ?? null;

  await partnerRepo.update(auth.admin, partner.id, {
    email_verified: verified,
    email_verified_at: verified ? new Date().toISOString() : null,
    last_verify_check_at: new Date().toISOString(),
    dns_records: records,
  });

  return ok({ ok: true, verified, status, dns_records: records });
});
