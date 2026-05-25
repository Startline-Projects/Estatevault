/**
 * GET /api/trustee/vault/file-key
 * Hands the authenticated trustee the OWNER's per-user FILES sub-key so the
 * browser can decrypt downloaded file/video ciphertext locally (large blobs
 * can't be routed through a serverless function).
 *
 * Mirrors /api/vault/file-key, but auth is the trustee session (the trustee is
 * not a Supabase user) and the DEK belongs to the bound owner (sess.clientId).
 * Re-verifies the unlock is still approved + not vetoed. Audited.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireTrusteeSession, SESSION_COOKIE } from "@/lib/security/trusteeSession";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";

export const runtime = "nodejs";

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

  const { data: ownerClient } = await db
    .from("clients")
    .select("id, wrapped_dek")
    .eq("id", sess.clientId)
    .single();
  if (!ownerClient) return NextResponse.json({ error: "owner not found" }, { status: 404 });

  const dek = await getOrCreateUserDek(db, ownerClient);
  let keyB64: string;
  try {
    const fileKey = await deriveSubKey(dek, INFO.FILES);
    keyB64 = Buffer.from(fileKey).toString("base64");
    zero(fileKey);
  } finally {
    zero(dek);
  }

  const ua = req.headers.get("user-agent") || null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await db.from("trustee_access_audit").insert({
    trustee_id: sess.trusteeId,
    client_id: sess.clientId,
    request_id: sess.requestId,
    action: "file_key_issued",
    ip, user_agent: ua,
  });

  return NextResponse.json({ key: keyB64, info: INFO.FILES });
}
