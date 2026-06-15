import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { partnerAddDomainSchema } from "@/lib/validation/schemas";
import { normalizeBusinessDomain } from "@/lib/hosts";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

async function registerVercelDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return { ok: false, error: "Domain registration not configured" };

  const res = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/domains`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: domain }),
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body?.error?.code === "domain_already_registered") return { ok: true };
    return { ok: false, error: body?.error?.message || "Failed to register domain" };
  }
  return { ok: true };
}

async function removeVercelDomain(domain: string): Promise<void> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return;
  await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
}

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getDomainInfoByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("No partner record", 400);

  const body = await req.json();
  const parsed = partnerAddDomainSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { businessUrl, domainType } = parsed.data;

  if (domainType === "custom_domain" && partner.tier !== "enterprise") {
    return fail("Custom domain requires Enterprise plan", 403);
  }

  const cleanDomain = normalizeBusinessDomain(businessUrl);
  if (!cleanDomain) return fail("Invalid businessUrl", 400);

  const fullDomain = domainType === "custom_domain" ? cleanDomain : `legacy.${cleanDomain}`;

  const updateField = domainType === "custom_domain" ? "custom_domain" : "subdomain";

  // Pre-check: domain not already claimed by another partner
  const { data: existing } = await auth.admin
    .from("partners")
    .select("id")
    .eq(updateField, fullDomain)
    .neq("id", partner.id)
    .maybeSingle();
  if (existing) return fail("Domain already claimed by another partner", 409);

  const oldDomain = domainType === "custom_domain" ? partner.custom_domain : partner.subdomain;
  if (oldDomain && oldDomain !== fullDomain) {
    await removeVercelDomain(oldDomain);
  }

  const { ok: vercelOk, error: vercelError } = await registerVercelDomain(fullDomain);
  if (!vercelOk) return fail(vercelError || "Domain registration failed", 500);

  const { error: updateError } = await partnerRepo.update(auth.admin, partner.id, { [updateField]: fullDomain });
  if (updateError) {
    await removeVercelDomain(fullDomain);
    return fail("Failed to save domain claim", 500);
  }

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "partner.domain_registered",
    resource_type: "partner",
    resource_id: partner.id,
    metadata: { domain: fullDomain, type: domainType },
  });

  return ok({ success: true, domain: fullDomain });
});

export const DELETE = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getDomainInfoByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("No partner record", 400);

  const { domainType } = await req.json();
  const domain = domainType === "custom_domain" ? partner.custom_domain : partner.subdomain;

  if (domain) {
    await removeVercelDomain(domain);
    const { error: updateError } = await partnerRepo.update(auth.admin, partner.id, {
      [domainType === "custom_domain" ? "custom_domain" : "subdomain"]: null,
    });
    if (updateError) return fail("Failed to clear domain", 500);
  }

  return ok({ success: true });
});
