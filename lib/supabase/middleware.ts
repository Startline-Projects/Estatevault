import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Skip auth checks if Supabase is not configured yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  // ── Custom domain / subdomain routing ──────────────────────────────────────
  // If the request comes from a partner's custom domain (e.g. legacy.thepeoplesfirm.com)
  // look up the partner by that hostname and rewrite to their slug page internally.
  const hostname = request.headers.get("host") || "";
  const partnerHostEnv = process.env.NEXT_PUBLIC_PARTNER_HOST || "pro.estatevault.us";
  const clientHostEnv = process.env.NEXT_PUBLIC_CLIENT_HOST || "estatevault.us";
  const isPartnerHost =
    hostname === partnerHostEnv ||
    hostname === "pro.estatevault.us" ||
    hostname.startsWith("pro.localhost");
  const isClientHost =
    hostname === clientHostEnv ||
    hostname === "estatevault.us" ||
    hostname === "www.estatevault.us" ||
    hostname.startsWith("app.localhost") ||
    hostname === "localhost:3000" ||
    hostname.startsWith("localhost:");
  const isMainDomain =
    isClientHost ||
    isPartnerHost ||
    hostname.startsWith("localhost") ||
    hostname.includes("vercel.app");

  const pathname = request.nextUrl.pathname;
  const skipRewrite = pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.startsWith("/favicon");

  if (!isMainDomain && hostname.includes(".") && !skipRewrite) {
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );

    // Extract subdomain prefix if hostname ends with .estatevault.us
    // vault_subdomain stores prefix only (e.g. "acme"), not full domain
    const vaultSubdomainPrefix = hostname.endsWith(".estatevault.us")
      ? hostname.replace(/\.estatevault\.us$/, "")
      : null;

    const { data: partner } = await adminSupabase
      .from("partners")
      .select("partner_slug, tier, vault_subdomain")
      .or(
        vaultSubdomainPrefix
          ? `subdomain.eq."${hostname}",custom_domain.eq."${hostname}",vault_subdomain.eq."${vaultSubdomainPrefix}"`
          : `subdomain.eq."${hostname}",custom_domain.eq."${hostname}"`
      )
      .eq("status", "active")
      .single();

    if (partner?.partner_slug) {
      const url = request.nextUrl.clone();
      const originalPath = request.nextUrl.pathname;

      // Basic-tier vault subdomain → rewrite root to /{slug}/vault
      const isVaultSubdomain =
        partner.tier === "basic" &&
        vaultSubdomainPrefix &&
        partner.vault_subdomain === vaultSubdomainPrefix;

      if (originalPath === "/" || originalPath === "") {
        url.pathname = isVaultSubdomain
          ? `/${partner.partner_slug}/vault`
          : `/${partner.partner_slug}`;
      } else {
        url.pathname = originalPath;
      }

      const rewriteResponse = NextResponse.rewrite(url);
      rewriteResponse.headers.set("x-partner-slug", partner.partner_slug);
      rewriteResponse.headers.set("x-partner-hostname", hostname);
      rewriteResponse.headers.set("x-is-vault-subdomain", isVaultSubdomain ? "1" : "0");
      return rewriteResponse;
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session, important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes, no auth required
  const publicPaths = ["/", "/quiz", "/will", "/trust", "/auth", "/attorney-referral", "/pro-partners", "/partners", "/professionals", "/farewell", "/khan-lawgroup", "/api/webhooks", "/api/documents/process", "/api/documents/cleanup-test-orders", "/api/documents/process-now", "/api/documents/check-status", "/api/attorney/check-sla", "/api/checkout", "/api/quiz", "/api/professionals", "/api/farewell", "/api/admin/test-promo", "/api/documents/download-zip", "/api/auth/set-password", "/api/auth/handoff", "/a", "/affiliate-signup", "/api/affiliate", "/vault/trustee-confirm", "/api/vault/trustees"];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // Partner slug pages (e.g. /the-peoples-firm) are public, single-segment paths
  // that don't match known app routes are treated as partner landing pages
  const knownAppPrefixes = ["/pro", "/auth", "/dashboard", "/quiz", "/will", "/trust", "/api", "/sales", "/attorney", "/legal", "/_next", "/favicon", "/a", "/affiliate", "/affiliate-signup"];
  const segments = pathname.split("/").filter(Boolean);
  const isPartnerSlug =
    !knownAppPrefixes.some((p) => pathname.startsWith(p)) &&
    (segments.length === 1 || (segments.length === 2 && segments[1] === "vault"));

  if (!isPublic && !isPartnerSlug && !user) {
    // API routes return JSON 401 (no redirect — caller should handle)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    // Not authenticated, redirect to universal login
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Fetch user profile once for role-based routing
  let userType: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .single();
    userType = profile?.user_type || null;
  }

  // Cross-portal guards: redirect users to their correct portal
  if (user && userType) {
    // Client dashboard, redirect non-clients to their portal
    if (pathname.startsWith("/dashboard")) {
      if (userType === "sales_rep" || userType === "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/sales/dashboard";
        return NextResponse.redirect(url);
      }
      if (userType === "partner") {
        const url = request.nextUrl.clone();
        url.pathname = "/pro/dashboard";
        return NextResponse.redirect(url);
      }
    }

    // Partner portal, only partners and admins
    if (pathname.startsWith("/pro") && pathname !== "/pro-partners") {
      const allowedTypes = ["partner", "admin"];
      if (!allowedTypes.includes(userType)) {
        if (userType === "sales_rep") {
          const url = request.nextUrl.clone();
          url.pathname = "/sales/dashboard";
          return NextResponse.redirect(url);
        }
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    // Sales portal, only sales_rep and admin
    if (pathname.startsWith("/sales/") || pathname === "/sales") {
      const salesTypes = ["sales_rep", "admin"];
      if (!salesTypes.includes(userType)) {
        if (userType === "partner") {
          const url = request.nextUrl.clone();
          url.pathname = "/pro/dashboard";
          return NextResponse.redirect(url);
        }
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  // ── Host-based portal isolation ──────────────────────────────────────────
  // Only enforce cross-host redirects when request is on a real subdomain
  // (app.*, pro.*, or production hosts). Plain `localhost:3000` and
  // preview/test envs skip this so existing behavior is preserved.
  const isSubdomainAware =
    hostname.startsWith("pro.") ||
    hostname.startsWith("app.") ||
    hostname === "estatevault.us" ||
    hostname === "www.estatevault.us" ||
    hostname === "pro.estatevault.us";

  if (isSubdomainAware) {
    const partnerOnlyPath =
      pathname.startsWith("/pro") && pathname !== "/pro-partners";
    const clientOnlyPath =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/quiz") ||
      pathname.startsWith("/will") ||
      pathname.startsWith("/trust");
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";

    if (isClientHost && partnerOnlyPath) {
      return NextResponse.redirect(
        `${proto}://${partnerHostEnv}${pathname}${request.nextUrl.search}`
      );
    }
    if (isPartnerHost && clientOnlyPath) {
      return NextResponse.redirect(
        `${proto}://${clientHostEnv}${pathname}${request.nextUrl.search}`
      );
    }
  }

  // Pass pathname to server components via header
  supabaseResponse.headers.set("x-url", request.nextUrl.pathname);

  return supabaseResponse;
}
