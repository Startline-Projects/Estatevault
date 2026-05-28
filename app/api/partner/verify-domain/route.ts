import { NextRequest } from "next/server";
import dns from "dns/promises";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const domain = new URL(req.url).searchParams.get("domain");
  if (!domain) return fail("Missing domain", 400);

  const { data: partner } = await partnerRepo.getDomainInfoByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("No partner record", 400);

  const isOwned = partner.subdomain === domain || partner.custom_domain === domain;
  if (!isOwned) return fail("Domain not associated with your account", 403);

  try {
    const records = await dns.resolveCname(domain);
    const validTargets = ["cname.estatevault.us", "cname.vercel-dns.com"];
    const matched = records.some((r) =>
      validTargets.some((t) => r.toLowerCase().includes(t.replace("cname.", "")))
    );

    if (matched) {
      await partnerRepo.update(auth.admin, partner.id, { domain_verified: true });
      return ok({ verified: true, records });
    }

    return ok({
      verified: false,
      records,
      message: "CNAME record found but points to the wrong destination. It should point to cname.estatevault.us",
    });
  } catch (dnsErr: unknown) {
    const errCode = (dnsErr as NodeJS.ErrnoException).code;
    if (errCode === "ENOTFOUND" || errCode === "ENODATA") {
      return ok({
        verified: false,
        records: [],
        message: "No CNAME record found yet. DNS changes can take up to 48 hours to propagate.",
      });
    }
    throw dnsErr;
  }
});
