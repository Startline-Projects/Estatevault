import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { verifyVetoToken } from "@/lib/security/vetoToken";
import { sendVetoAccessCancelledEmail } from "@/lib/email";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import { farewellOwnerVetoSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export const GET = withRoute(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return fail("missing token", 400);

  const v = verifyVetoToken(token);
  if (!v.ok) return fail(v.error, 400);

  const admin = createAdminClient();
  const { data: reqRow } = await admin
    .from("farewell_verification_requests")
    .select("id, client_id, status, vault_unlock_approved, unlock_window_expires_at, owner_vetoed_at, owner_veto_token_hash")
    .eq("id", v.requestId)
    .single();

  if (!reqRow) return fail("request not found", 404);
  if (reqRow.owner_veto_token_hash !== hashToken(token)) return fail("token mismatch", 400);
  if (reqRow.owner_vetoed_at) return ok({ ok: false, alreadyVetoed: true });
  if (!reqRow.vault_unlock_approved) return fail("not in unlock window", 400);

  return ok({ ok: true, requestId: reqRow.id, expiresAt: reqRow.unlock_window_expires_at });
});

export const POST = withRoute(async (req: NextRequest) => {
  const rawBody = await req.json().catch(() => null);
  const parsed = farewellOwnerVetoSchema.safeParse(rawBody);
  if (!parsed.success) return fail("invalid payload", 400);
  const { token } = parsed.data;

  const v = verifyVetoToken(token);
  if (!v.ok) return fail(v.error, 400);

  const admin = createAdminClient();
  const { data: reqRow } = await admin
    .from("farewell_verification_requests")
    .select("id, client_id, trustee_email, status, vault_unlock_approved, owner_vetoed_at, owner_veto_token_hash")
    .eq("id", v.requestId)
    .single();

  if (!reqRow) return fail("request not found", 404);
  if (reqRow.owner_veto_token_hash !== hashToken(token)) return fail("token mismatch", 400);
  if (reqRow.owner_vetoed_at) return ok({ ok: true, alreadyVetoed: true });
  if (!reqRow.vault_unlock_approved) return fail("not in unlock window", 400);

  const now = new Date().toISOString();
  await admin.from("farewell_verification_requests").update({
    owner_vetoed_at: now,
    status: "rejected",
    vault_unlock_approved: false,
    owner_veto_token_hash: null,
    share_c_hash: null,
    trustee_access_token_hash: null,
    access_expires_at: null,
  }).eq("id", reqRow.id);

  await admin.from("farewell_messages").update({ vault_farewell_status: "locked" })
    .eq("client_id", reqRow.client_id)
    .in("vault_farewell_status", ["pending_verification", "unlocked"]);

  await auditLogRepo.insertEntry(admin, {
    action: "farewell.owner_vetoed",
    resource_type: "farewell_verification_request",
    resource_id: reqRow.id,
    metadata: { client_id: reqRow.client_id, trustee_email: reqRow.trustee_email },
  });

  try {
    if (reqRow.trustee_email) {
      await sendVetoAccessCancelledEmail({ to: reqRow.trustee_email });
    }
  } catch (e) { console.error("[veto] trustee notify failed:", e); }

  return ok({ ok: true });
});
