import { NextRequest } from "next/server";
import { requireAuth, createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

async function registerVercelDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    console.log(`[dev] Skipping Vercel domain registration for: ${domain}`);
    return { ok: true };
  }

  const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: domain }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.error?.code === "domain_already_registered") return { ok: true };
    return { ok: false, error: body.error?.message || "Vercel registration failed" };
  }
  return { ok: true };
}

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,50}[a-z0-9]$/;

export const GET = withRoute(async (req: NextRequest) => {
  const subdomain = new URL(req.url).searchParams.get("subdomain")?.toLowerCase().trim();
  if (!subdomain || !SUBDOMAIN_REGEX.test(subdomain)) {
    return ok({ available: false, error: "Invalid subdomain format" });
  }

  const admin = createAdminClient();
  const { data } = await partnerRepo.isSubdomainTaken(admin, subdomain);
  return ok({ available: !data });
});

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { partnerId, subdomain } = await req.json();
  if (!partnerId || !subdomain) return fail("Missing partnerId or subdomain", 400);
  if (!SUBDOMAIN_REGEX.test(subdomain)) return fail("Invalid subdomain format", 400);

  const { data: partner } = await partnerRepo.getDomainInfoByProfileId(auth.admin, auth.profile.id);
  if (!partner || partner.id !== partnerId) return fail("Not authorized", 403);
  if (partner.tier !== "basic") return fail("Vault subdomain only available on Basic tier", 400);
  if (partner.vault_subdomain) return fail("Subdomain already set", 409);

  const { data: existing } = await partnerRepo.isSubdomainTaken(auth.admin, subdomain);
  if (existing) return fail("Subdomain already taken", 409);

  const fullDomain = `${subdomain}.estatevault.us`;
  const vercel = await registerVercelDomain(fullDomain);
  if (!vercel.ok) return fail(vercel.error || "Domain registration failed", 500);

  const { error: saveErr } = await partnerRepo.update(auth.admin, partnerId, {
    vault_subdomain: subdomain,
    onboarding_completed: true,
    status: "active",
    onboarding_step: 4,
  });
  if (saveErr) return fail("Failed to save subdomain", 500);

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "partner.vault_subdomain_claimed",
    resource_type: "partner",
    resource_id: partnerId,
    metadata: { subdomain, full_domain: fullDomain },
  });

  return ok({ subdomain, url: `https://${fullDomain}` });
});
