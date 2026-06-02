import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { requireTrusteeSession, SESSION_COOKIE } from "@/lib/security/trusteeSession";
import { resolveTrusteeScope, categoryAllowed } from "@/lib/security/trusteeScope";
import * as fvRepo from "@/lib/repos/server/farewellVerificationRepo";

export const runtime = "nodejs";
const SIGN_TTL = 60;

export const GET = withRoute(async (req: NextRequest) => {
  const sess = requireTrusteeSession();
  if (!sess) return fail("no session", 401);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if (!type || !id) return fail("missing params", 400);
  if (type !== "document" && type !== "farewell" && type !== "vault_item") {
    return fail("bad type", 400);
  }

  const admin = createAdminClient();

  const { data: r } = await fvRepo.verifyAccessStillValid(admin, sess.requestId);
  if (!r || r.owner_vetoed_at || !r.vault_unlock_approved) {
    const res = fail("access revoked", 403);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // M-9: enforce the same access_scope the list route uses, before signing.
  const { data: trusteeRow } = await admin
    .from("vault_trustees")
    .select("access_scope")
    .eq("id", sess.trusteeId)
    .maybeSingle();
  const scope = resolveTrusteeScope(trusteeRow?.access_scope);

  let bucket: string, storagePath: string | null = null;
  if (type === "document") {
    if (!scope.allowDocuments) return fail("not found", 404);
    const { data } = await admin.from("documents").select("storage_path, client_id").eq("id", id).single();
    if (!data || data.client_id !== sess.clientId) return fail("not found", 404);
    bucket = "documents";
    storagePath = data.storage_path;
  } else if (type === "vault_item") {
    const { data } = await admin.from("vault_items").select("storage_path, client_id, category").eq("id", id).single();
    if (!data || data.client_id !== sess.clientId) return fail("not found", 404);
    if (!categoryAllowed(scope, data.category)) return fail("not found", 404);
    bucket = "documents";
    storagePath = data.storage_path;
  } else {
    if (!scope.allowFarewell) return fail("not found", 404);
    const { data } = await admin.from("farewell_messages").select("storage_path, client_id").eq("id", id).single();
    if (!data || data.client_id !== sess.clientId) return fail("not found", 404);
    bucket = "farewell-videos";
    storagePath = data.storage_path;
  }

  if (!storagePath) return fail("no storage path", 404);

  const { data: signed, error } = await admin.storage.from(bucket).createSignedUrl(storagePath, SIGN_TTL);
  if (error || !signed?.signedUrl) {
    console.error("[trustee download-url] sign failed:", error);
    return fail("sign failed", 500);
  }

  const ua = req.headers.get("user-agent") || null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await fvRepo.insertTrusteeAudit(admin, {
    trustee_id: sess.trusteeId,
    client_id: sess.clientId,
    request_id: sess.requestId,
    action:
      type === "document" ? "download_document"
      : type === "vault_item" ? "download_vault_item"
      : "download_farewell",
    resource_type: type,
    resource_id: id,
    ip, user_agent: ua,
  });

  return ok({ ok: true, url: signed.signedUrl, ttlSeconds: SIGN_TTL });
});
