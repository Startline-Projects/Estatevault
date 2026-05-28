import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import {
  ShamirSetupSchema,
  b64decode,
  bytesToBytea,
  validateEnvelope,
  requireClientUser,
  checkRate,
  limiters,
  logAudit,
} from "@/lib/api/crypto";
import { encryptShareC } from "@/lib/crypto/trusteeRelease";

export const runtime = "nodejs";

const SHARE_LEN = 33;
const MAX_WRAPPED_MK = 256;

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req, { autoCreate: false });
  if ("error" in ctx) return ctx.error;
  const { admin, user, profile, client } = ctx;

  const rl = await checkRate(limiters.rotate, `shamir-setup:${user.id}`);
  if (rl) return rl;

  if (!client.crypto_setup_at) return fail("vault not bootstrapped", 409);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("bad json", 400); }
  const parsed = ShamirSetupSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400, { details: parsed.error.flatten() });
  const p = parsed.data;

  let shareA: Uint8Array, shareC: Uint8Array, wrappedMkShamir: Uint8Array;
  try {
    shareA = b64decode(p.shareA);
    shareC = b64decode(p.shareC);
    wrappedMkShamir = b64decode(p.wrappedMkShamir);
  } catch {
    return fail("bad base64", 400);
  }

  if (shareA.length !== SHARE_LEN) return fail("bad shareA length", 400);
  if (shareC.length !== SHARE_LEN) return fail("bad shareC length", 400);
  if (shareA[0] !== 1) return fail("shareA must be index 1", 400);
  if (shareC[0] !== 3) return fail("shareC must be index 3", 400);

  try {
    validateEnvelope(wrappedMkShamir, MAX_WRAPPED_MK);
  } catch (e) {
    return fail(`wrappedMkShamir invalid: ${(e as Error).message}`, 400);
  }

  let shareCEnc: Uint8Array;
  try {
    shareCEnc = await encryptShareC(shareC);
  } catch (e) {
    console.error("[shamir-setup] share C encryption failed:", e);
    return fail("server key unavailable", 500);
  } finally {
    shareC.fill(0);
  }

  const { error } = await admin
    .from("clients")
    .update({
      vault_master_share_a: bytesToBytea(shareA),
      vault_master_share_c_enc: bytesToBytea(shareCEnc),
      vault_wrapped_mk_shamir: bytesToBytea(wrappedMkShamir),
      vault_shamir_version: p.shamirVersion,
      vault_shamir_initialized_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  if (error) return fail("db update failed", 500);

  await logAudit(admin, {
    actor_id: profile.id,
    action: "trustee.shamir_setup",
    meta: { client_id: client.id, version: p.shamirVersion },
  });

  return ok({ ok: true, initializedAt: new Date().toISOString() });
});

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req, { autoCreate: false });
  if ("error" in ctx) return ctx.error;
  const client = ctx.client as typeof ctx.client & {
    vault_shamir_initialized_at?: string | null;
    vault_shamir_version?: number | null;
  };
  return ok({
    initialized: !!client.vault_shamir_initialized_at,
    initializedAt: client.vault_shamir_initialized_at ?? null,
    version: client.vault_shamir_version ?? null,
  });
});
