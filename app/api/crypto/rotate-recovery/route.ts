import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import {
  RotateRecoverySchema,
  b64decode,
  bytesToBytea,
  validateEnvelope,
  requireClientUser,
  checkRate,
  limiters,
  logAudit,
} from "@/lib/api/crypto";

export const runtime = "nodejs";

const MAX_WRAPPED = 256;

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { admin, user, profile, client } = ctx;

  const rl = await checkRate(limiters.rotate, `rotate-rec:${user.id}`);
  if (rl) return rl;

  if (!client.crypto_setup_at) return fail("crypto not bootstrapped", 409);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("bad json", 400); }
  const parsed = RotateRecoverySchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400, { details: parsed.error.flatten() });

  let wrappedRec: Uint8Array;
  try {
    wrappedRec = b64decode(parsed.data.wrappedMkRecovery);
  } catch {
    return fail("bad base64", 400);
  }
  try {
    validateEnvelope(wrappedRec, MAX_WRAPPED);
  } catch (e) {
    return fail(`envelope invalid: ${(e as Error).message}`, 400);
  }

  const { error } = await admin
    .from("clients")
    .update({ wrapped_mk_recovery: bytesToBytea(wrappedRec) })
    .eq("id", client.id);

  if (error) return fail("db update failed", 500);

  await logAudit(admin, {
    actor_id: profile.id,
    action: "crypto.rotate_recovery",
    meta: { client_id: client.id, sensitive: true },
  });

  return ok({ ok: true });
});
