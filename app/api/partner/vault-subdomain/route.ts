import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

async function registerVercelDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  // Skip in dev/local when Vercel credentials not configured
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

// GET /api/partner/vault-subdomain?subdomain=foo
// Check if vault subdomain is available
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subdomain = searchParams.get("subdomain")?.toLowerCase().trim();

  if (!subdomain || !SUBDOMAIN_REGEX.test(subdomain)) {
    return NextResponse.json({ available: false, error: "Invalid subdomain format" });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("partners")
    .select("id")
    .eq("vault_subdomain", subdomain)
    .maybeSingle();

  return NextResponse.json({ available: !data });
}

// POST /api/partner/vault-subdomain
// Claim subdomain — registers on Vercel + saves to DB
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { partnerId, subdomain } = await request.json();
  if (!partnerId || !subdomain) {
    return NextResponse.json({ error: "Missing partnerId or subdomain" }, { status: 400 });
  }
  if (!SUBDOMAIN_REGEX.test(subdomain)) {
    return NextResponse.json({ error: "Invalid subdomain format" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify caller owns this partner record and is basic tier
  const { data: partner } = await admin
    .from("partners")
    .select("id, tier, profile_id, vault_subdomain")
    .eq("id", partnerId)
    .single();

  if (!partner || partner.profile_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (partner.tier !== "basic") {
    return NextResponse.json({ error: "Vault subdomain only available on Basic tier" }, { status: 400 });
  }
  if (partner.vault_subdomain) {
    return NextResponse.json({ error: "Subdomain already set" }, { status: 409 });
  }

  // Check availability
  const { data: existing } = await admin
    .from("partners")
    .select("id")
    .eq("vault_subdomain", subdomain)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Subdomain already taken" }, { status: 409 });
  }

  // Register on Vercel
  const fullDomain = `${subdomain}.estatevault.us`;
  const vercel = await registerVercelDomain(fullDomain);
  if (!vercel.ok) {
    return NextResponse.json({ error: vercel.error || "Domain registration failed" }, { status: 500 });
  }

  // Save to DB + mark onboarding complete
  const { error: saveErr } = await admin.from("partners").update({
    vault_subdomain: subdomain,
    onboarding_completed: true,
    status: "active",
    onboarding_step: 4,
  }).eq("id", partnerId);

  if (saveErr) {
    return NextResponse.json({ error: "Failed to save subdomain" }, { status: 500 });
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "partner.vault_subdomain_claimed",
    resource_type: "partner",
    resource_id: partnerId,
    metadata: { subdomain, full_domain: fullDomain },
  });

  return NextResponse.json({ subdomain, url: `https://${fullDomain}` });
}
