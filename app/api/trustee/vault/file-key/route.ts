import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { requireTrusteeSession, SESSION_COOKIE } from "@/lib/security/trusteeSession";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import * as fvRepo from "@/lib/repos/server/farewellVerificationRepo";

export const runtime = "nodejs";

export const GET = withRoute(async (req: NextRequest) => {
  const sess = requireTrusteeSession();
  if (!sess) return fail("no session", 401);

  const admin = createAdminClient();

  const { data: r } = await fvRepo.verifyAccessStillValid(admin, sess.requestId);
  if (!r || r.owner_vetoed_at || !r.vault_unlock_approved) {
    const res = fail("access revoked", 403);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  const { data: ownerClient } = await admin
    .from("clients")
    .select("id, wrapped_dek")
    .eq("id", sess.clientId)
    .single();
  if (!ownerClient) return fail("owner not found", 404);

  const dek = await getOrCreateUserDek(admin, ownerClient);
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
  await fvRepo.insertTrusteeAudit(admin, {
    trustee_id: sess.trusteeId,
    client_id: sess.clientId,
    request_id: sess.requestId,
    action: "file_key_issued",
    ip, user_agent: ua,
  });

  return ok({ key: keyB64, info: INFO.FILES });
});
