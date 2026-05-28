import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import {
  BootstrapSchema,
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
const PUBKEY_LEN = 32;
const SALT_LEN = 16;

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, user, profile, client } = ctx;

  const rl = await checkRate(limiters.bootstrap, `bootstrap:${user.id}`);
  if (rl) return rl;

  if (client.crypto_setup_at) return fail("crypto already bootstrapped", 409);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("bad json", 400); }
  const parsed = BootstrapSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400, { details: parsed.error.flatten() });
  const p = parsed.data;

  let salt: Uint8Array, wrappedPass: Uint8Array, wrappedRec: Uint8Array, pubX: Uint8Array, pubE: Uint8Array;
  try {
    salt = b64decode(p.salt);
    wrappedPass = b64decode(p.wrappedMkPass);
    wrappedRec = b64decode(p.wrappedMkRecovery);
    pubX = b64decode(p.pubX25519);
    pubE = b64decode(p.pubEd25519);
  } catch {
    return fail("bad base64", 400);
  }

  if (salt.length !== SALT_LEN) return fail("bad salt length", 400);
  if (pubX.length !== PUBKEY_LEN || pubE.length !== PUBKEY_LEN) return fail("bad pubkey length", 400);
  try {
    validateEnvelope(wrappedPass, MAX_WRAPPED);
    validateEnvelope(wrappedRec, MAX_WRAPPED);
  } catch (e) {
    return fail(`envelope invalid: ${(e as Error).message}`, 400);
  }

  const { error } = await admin
    .from("clients")
    .update({
      kdf_salt: wrappedPass.length ? bytesToBytea(salt) : null,
      kdf_params: p.kdfParams,
      wrapped_mk_pass: bytesToBytea(wrappedPass),
      wrapped_mk_recovery: bytesToBytea(wrappedRec),
      pubkey_x25519: bytesToBytea(pubX),
      pubkey_ed25519: bytesToBytea(pubE),
      enc_version: 1,
      crypto_setup_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  if (error) return fail("db update failed", 500);

  await logAudit(admin, {
    actor_id: profile.id,
    action: "crypto.bootstrap",
    meta: { client_id: client.id },
  });

  return ok({ ok: true });
});
