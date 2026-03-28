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
  const publicPaths = ["/", "/quiz", "/will", "/trust", "/auth", "/attorney-referral", "/pro/login", "/pro-partners", "/partners", "/professionals", "/api/webhooks", "/api/documents/process", "/api/attorney/check-sla", "/api/checkout", "/api/quiz", "/api/professionals"];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  ) || pathname === "/sales";

  if (!isPublic && !user) {
    // Not authenticated — redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Protected partner/admin routes
  if (user && pathname.startsWith("/pro")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .single();

    const allowedTypes = ["partner", "sales_rep", "admin"];
    if (!profile || !allowedTypes.includes(profile.user_type)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Redirect sales_rep users from /pro to /sales/dashboard
    if (profile?.user_type === "sales_rep") {
      const url = request.nextUrl.clone();
      url.pathname = "/sales/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Protected sales routes
  if (pathname.startsWith("/sales/") && pathname !== "/sales") {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/sales";
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .single();

    const salesTypes = ["sales_rep", "admin"];
    if (!profile || !salesTypes.includes(profile.user_type)) {
      // Redirect wrong user types
      if (profile?.user_type === "partner") {
        const url = request.nextUrl.clone();
        url.pathname = "/pro/dashboard";
        return NextResponse.redirect(url);
      }
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
