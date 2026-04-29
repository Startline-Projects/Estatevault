export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AFFILIATE_COOKIE, AFFILIATE_COOKIE_MAX_AGE, hashIp } from "@/lib/affiliate";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code;
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const redirectUrl = `${origin}/`;

  if (!code || code.length > 32) {
    return NextResponse.redirect(redirectUrl, 302);
  }

  const supabase = createAdminClient();

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id, status")
    .eq("code", code.toUpperCase())
    .single();

  if (!affiliate || affiliate.status !== "active") {
    return NextResponse.redirect(redirectUrl, 302);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;
  const referrer = request.headers.get("referer") || null;

  await supabase.from("affiliate_clicks").insert({
    affiliate_id: affiliate.id,
    ip_hash: hashIp(ip),
    user_agent: userAgent,
    referrer,
    landing_path: url.pathname,
  });

  await supabase.rpc("increment_affiliate_clicks", { p_affiliate_id: affiliate.id });

  const response = NextResponse.redirect(redirectUrl, 302);
  response.cookies.set(AFFILIATE_COOKIE, affiliate.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AFFILIATE_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
