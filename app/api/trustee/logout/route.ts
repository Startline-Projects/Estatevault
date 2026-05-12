import { NextResponse } from "next/server";
import { requireTrusteeSession, SESSION_COOKIE } from "@/lib/security/trusteeSession";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function POST() {
  const sess = requireTrusteeSession();
  if (sess) {
    const db = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    await db.from("trustee_access_audit").insert({
      trustee_id: sess.trusteeId,
      client_id: sess.clientId,
      request_id: sess.requestId,
      action: "logout",
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
