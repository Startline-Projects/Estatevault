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
  const isMainDomain =
    hostname === "estatevault.us" ||
    hostname === "www.estatevault.us" ||
    hostname.startsWith("localhost") ||
    hostname.includes("vercel.app");

  if (!isMainDomain && hostname.includes(".")) {
    // Fetch partner by subdomain or custom_domain
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );

    const { data: partner } = await adminSupabase
      .from("partners")
      .select("partner_slug")
      .or(`subdomain.eq.${hostname},custom_domain.eq.${hostname}`)
      .eq("status", "active")
      .single();

    if (partner?.partner_slug) {
      // Rewrite the request to the partner's slug page, preserving the path
      const url = request.nextUrl.clone();
      const originalPath = request.nextUrl.pathname;

      // If root, rewrite to partner landing page
      if (originalPath === "/" || originalPath === "") {
        url.pathname = `/${partner.partner_slug}`;
      } else {
        // Preserve deeper paths (e.g. /quiz, /will) for the partner's flow
        url.pathname = originalPath;
      }
      // Pass partner context via header so pages know which partner is active
      const rewriteResponse = NextResponse.rewrite(url);
      rewriteResponse.headers.set("x-partner-slug", partner.partner_slug);
      rewriteResponse.headers.set("x-partner-hostname", hostname);
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

  // Refresh the session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes — no auth required
  const publicPaths = ["/", "/quiz", "/will", "/trust", "/auth", "/attorney-referral", "/pro-partners", "/partners", "/professionals", "/farewell", "/api/webhooks", "/api/documents/process", "/api/documents/cleanup-test-orders", "/api/documents/process-now", "/api/documents/check-status", "/api/attorney/check-sla", "/api/checkout", "/api/quiz", "/api/professionals", "/api/farewell", "/api/admin/test-promo", "/api/documents/download-zip", "/api/auth/set-password"];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // Partner slug pages (e.g. /the-peoples-firm) are public — single-segment paths
  // that don't match known app routes are treated as partner landing pages
  const knownAppPrefixes = ["/pro", "/auth", "/dashboard", "/quiz", "/will", "/trust", "/api", "/sales", "/attorney", "/legal", "/_next", "/favicon"];
  const segments = pathname.split("/").filter(Boolean);
  const isPartnerSlug = segments.length === 1 && !knownAppPrefixes.some((p) => pathname.startsWith(p));

  if (!isPublic && !isPartnerSlug && !user) {
    // Not authenticated — redirect to universal login
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
    // Client dashboard — redirect non-clients to their portal
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

    // Partner portal — only partners and admins
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

    // Sales portal — only sales_rep and admin
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

  // Pass pathname to server components via header
  supabaseResponse.headers.set("x-url", request.nextUrl.pathname);

  return supabaseResponse;
}
