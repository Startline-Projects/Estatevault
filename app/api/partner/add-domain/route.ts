import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { normalizeBusinessDomain } from "@/lib/hosts";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Register or remove a custom domain on Vercel for a partner
// POST, add domain
// DELETE, remove domain

async function registerVercelDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    console.error("Missing VERCEL_API_TOKEN or VERCEL_PROJECT_ID");
    return { ok: false, error: "Domain registration not configured" };
  }

  const res = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/domains`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // domain_already_registered is fine, it's already on the project
    if (body?.error?.code === "domain_already_registered") return { ok: true };
    console.error("Vercel domain registration error:", body);
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
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: partner } = await admin
      .from("partners")
      .select("id, partner_slug, subdomain, custom_domain, tier")
      .eq("profile_id", user.id)
      .single();

    if (!partner) return NextResponse.json({ error: "No partner record" }, { status: 400 });

    const { businessUrl, domainType } = await request.json();
    // domainType: "subdomain" (standard) or "custom_domain" (enterprise)

    if (!businessUrl) return NextResponse.json({ error: "Missing businessUrl" }, { status: 400 });

    // Enforce tier: only enterprise can use custom_domain
    if (domainType === "custom_domain" && partner.tier !== "enterprise") {
      return NextResponse.json({ error: "Custom domain requires Enterprise plan" }, { status: 403 });
    }

    // Build the full domain string
    const cleanDomain = normalizeBusinessDomain(businessUrl);
    if (!cleanDomain) {
      return NextResponse.json({ error: "Invalid businessUrl" }, { status: 400 });
    }
    const fullDomain = domainType === "custom_domain"
      ? cleanDomain
      : `legacy.${cleanDomain}`;

    // Remove old domain from Vercel if changing
    const oldDomain = domainType === "custom_domain" ? partner.custom_domain : partner.subdomain;
    if (oldDomain && oldDomain !== fullDomain) {
      await removeVercelDomain(oldDomain);
    }

    // Register new domain on Vercel
    const { ok, error: vercelError } = await registerVercelDomain(fullDomain);
    if (!ok) {
      return NextResponse.json({ error: vercelError }, { status: 500 });
    }

    // Save to database
    const updateField = domainType === "custom_domain" ? "custom_domain" : "subdomain";
    await admin
      .from("partners")
      .update({ [updateField]: fullDomain })
      .eq("id", partner.id);

    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "partner.domain_registered",
      resource_type: "partner",
      resource_id: partner.id,
      metadata: { domain: fullDomain, type: domainType },
    });

    return NextResponse.json({ success: true, domain: fullDomain });
  } catch (error) {
    console.error("Add domain error:", error);
    return NextResponse.json({ error: "Failed to register domain" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: partner } = await admin
      .from("partners")
      .select("id, subdomain, custom_domain")
      .eq("profile_id", user.id)
      .single();

    if (!partner) return NextResponse.json({ error: "No partner record" }, { status: 400 });

    const { domainType } = await request.json();
    const domain = domainType === "custom_domain" ? partner.custom_domain : partner.subdomain;

    if (domain) {
      await removeVercelDomain(domain);
      await admin
        .from("partners")
        .update({ [domainType === "custom_domain" ? "custom_domain" : "subdomain"]: null })
        .eq("id", partner.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove domain error:", error);
    return NextResponse.json({ error: "Failed to remove domain" }, { status: 500 });
  }
}
