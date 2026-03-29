import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Skip auth checks if Supabase is not configured yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

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
  const publicPaths = ["/", "/quiz", "/will", "/trust", "/auth", "/attorney-referral", "/pro-partners", "/partners", "/professionals", "/farewell", "/api/webhooks", "/api/documents/process", "/api/attorney/check-sla", "/api/checkout", "/api/quiz", "/api/professionals", "/api/farewell"];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!isPublic && !user) {
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

  return supabaseResponse;
}
