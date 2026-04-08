import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import dns from "dns/promises";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// GET /api/partner/verify-domain?domain=legacy.thepeoplesfirm.com
// Checks if the CNAME record resolves to cname.estatevault.us or cname.vercel-dns.com
export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");
    if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

    // Verify the partner owns this domain record
    const admin = createAdminClient();
    const { data: partner } = await admin
      .from("partners")
      .select("id, subdomain, custom_domain")
      .eq("profile_id", user.id)
      .single();

    if (!partner) return NextResponse.json({ error: "No partner record" }, { status: 400 });

    const isOwned = partner.subdomain === domain || partner.custom_domain === domain;
    if (!isOwned) return NextResponse.json({ error: "Domain not associated with your account" }, { status: 403 });

    // Do DNS CNAME lookup
    try {
      const records = await dns.resolveCname(domain);
      const validTargets = ["cname.estatevault.us", "cname.vercel-dns.com"];
      const matched = records.some((r) =>
        validTargets.some((t) => r.toLowerCase().includes(t.replace("cname.", "")))
      );

      if (matched) {
        // Update domain_verified flag in DB
        await admin
          .from("partners")
          .update({ domain_verified: true })
          .eq("id", partner.id);

        return NextResponse.json({ verified: true, records });
      }

      return NextResponse.json({
        verified: false,
        records,
        message: "CNAME record found but points to the wrong destination. It should point to cname.estatevault.us",
      });
    } catch (dnsErr: unknown) {
      const errCode = (dnsErr as NodeJS.ErrnoException).code;
      if (errCode === "ENOTFOUND" || errCode === "ENODATA") {
        return NextResponse.json({
          verified: false,
          records: [],
          message: "No CNAME record found yet. DNS changes can take up to 48 hours to propagate.",
        });
      }
      throw dnsErr;
    }
  } catch (error) {
    console.error("Verify domain error:", error);
    return NextResponse.json({ error: "DNS check failed" }, { status: 500 });
  }
}
