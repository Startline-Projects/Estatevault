import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import {
  RotatePassphraseSchema,
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
const SALT_LEN = 16;

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { admin, user, profile, client } = ctx;

  const rl = await checkRate(limiters.rotate, `rotate:${user.id}`);
  if (rl) return rl;

  if (!client.crypto_setup_at) return fail("crypto not bootstrapped", 409);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("bad json", 400); }
  const parsed = RotatePassphraseSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400, { details: parsed.error.flatten() });

  let salt: Uint8Array, wrappedPass: Uint8Array;
  try {
    salt = b64decode(parsed.data.salt);
    wrappedPass = b64decode(parsed.data.wrappedMkPass);
  } catch {
    return fail("bad base64", 400);
  }

  if (salt.length !== SALT_LEN) return fail("bad salt length", 400);
  try {
    validateEnvelope(wrappedPass, MAX_WRAPPED);
  } catch (e) {
    return fail(`envelope invalid: ${(e as Error).message}`, 400);
  }

  const { error } = await admin
    .from("clients")
    .update({
      kdf_salt: bytesToBytea(salt),
      kdf_params: parsed.data.kdfParams,
      wrapped_mk_pass: bytesToBytea(wrappedPass),
    })
    .eq("id", client.id);

  if (error) return fail("db update failed", 500);

  await logAudit(admin, {
    actor_id: profile.id,
    action: "crypto.rotate_passphrase",
    meta: { client_id: client.id },
  });

  return ok({ ok: true });
});
