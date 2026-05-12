/**
 * GET /api/trustee/vault/download-url?type=document|farewell&id=...
 * Returns 60-second signed URL for the storage object belonging to the
 * trustee's bound client. Read-only. Audited.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireTrusteeSession, SESSION_COOKIE } from "@/lib/security/trusteeSession";

export const runtime = "nodejs";
const SIGN_TTL = 60;

function admin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export async function GET(req: Request) {
  const sess = requireTrusteeSession();
  if (!sess) return NextResponse.json({ error: "no session" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if (!type || !id) return NextResponse.json({ error: "missing params" }, { status: 400 });
  if (type !== "document" && type !== "farewell") {
    return NextResponse.json({ error: "bad type" }, { status: 400 });
  }

  const db = admin();

  // Re-verify access.
  const { data: r } = await db
    .from("farewell_verification_requests")
    .select("owner_vetoed_at, vault_unlock_approved")
    .eq("id", sess.requestId)
    .single();
  if (!r || r.owner_vetoed_at || !r.vault_unlock_approved) {
    const res = NextResponse.json({ error: "access revoked" }, { status: 403 });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  let bucket: string, storagePath: string | null = null;
  if (type === "document") {
    const { data } = await db.from("documents").select("storage_path, client_id").eq("id", id).single();
    if (!data || data.client_id !== sess.clientId) return NextResponse.json({ error: "not found" }, { status: 404 });
    bucket = "documents";
    storagePath = data.storage_path;
  } else {
    const { data } = await db.from("farewell_messages").select("storage_path, client_id").eq("id", id).single();
    if (!data || data.client_id !== sess.clientId) return NextResponse.json({ error: "not found" }, { status: 404 });
    bucket = "farewell-videos";
    storagePath = data.storage_path;
  }

  if (!storagePath) return NextResponse.json({ error: "no storage path" }, { status: 404 });

  const { data: signed, error } = await db.storage.from(bucket).createSignedUrl(storagePath, SIGN_TTL);
  if (error || !signed?.signedUrl) {
    console.error("[trustee download-url] sign failed:", error);
    return NextResponse.json({ error: "sign failed" }, { status: 500 });
  }

  const ua = req.headers.get("user-agent") || null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await db.from("trustee_access_audit").insert({
    trustee_id: sess.trusteeId,
    client_id: sess.clientId,
    request_id: sess.requestId,
    action: type === "document" ? "download_document" : "download_farewell",
    resource_type: type,
    resource_id: id,
    ip, user_agent: ua,
  });

  return NextResponse.json({ ok: true, url: signed.signedUrl, ttlSeconds: SIGN_TTL });
}
