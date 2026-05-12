import { NextRequest, NextResponse } from "next/server";
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

const SHARE_LEN = 33;            // index(1) + value(32)
const MAX_WRAPPED_MK = 256;

export async function POST(req: NextRequest) {
  const ctx = await requireClientUser(req, { autoCreate: false });
  if ("error" in ctx) return ctx.error;
  const { admin, user, profile, client } = ctx;

  const rl = await checkRate(limiters.rotate, `shamir-setup:${user.id}`);
  if (rl) return rl;

  if (!client.crypto_setup_at) {
    return NextResponse.json({ error: "vault not bootstrapped" }, { status: 409 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const parsed = ShamirSetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  let shareA: Uint8Array, shareC: Uint8Array, wrappedMkShamir: Uint8Array;
  try {
    shareA = b64decode(p.shareA);
    shareC = b64decode(p.shareC);
    wrappedMkShamir = b64decode(p.wrappedMkShamir);
  } catch {
    return NextResponse.json({ error: "bad base64" }, { status: 400 });
  }

  if (shareA.length !== SHARE_LEN) return NextResponse.json({ error: "bad shareA length" }, { status: 400 });
  if (shareC.length !== SHARE_LEN) return NextResponse.json({ error: "bad shareC length" }, { status: 400 });
  if (shareA[0] !== 1) return NextResponse.json({ error: "shareA must be index 1" }, { status: 400 });
  if (shareC[0] !== 3) return NextResponse.json({ error: "shareC must be index 3" }, { status: 400 });

  try {
    validateEnvelope(wrappedMkShamir, MAX_WRAPPED_MK);
  } catch (e) {
    return NextResponse.json({ error: `wrappedMkShamir invalid: ${(e as Error).message}` }, { status: 400 });
  }

  // Encrypt Share C under server-side TRUSTEE_RELEASE_KEY before persisting.
  let shareCEnc: Uint8Array;
  try {
    shareCEnc = await encryptShareC(shareC);
  } catch (e) {
    console.error("[shamir-setup] share C encryption failed:", e);
    return NextResponse.json({ error: "server key unavailable" }, { status: 500 });
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

  if (error) {
    console.error("[shamir-setup] db update failed:", error);
    return NextResponse.json({ error: "db update failed" }, { status: 500 });
  }

  await logAudit(admin, {
    actor_id: profile.id,
    action: "trustee.shamir_setup",
    meta: { client_id: client.id, version: p.shamirVersion },
  });

  return NextResponse.json({ ok: true, initializedAt: new Date().toISOString() });
}

// GET — return setup status (does NOT return key material).
export async function GET(req: NextRequest) {
  const ctx = await requireClientUser(req, { autoCreate: false });
  if ("error" in ctx) return ctx.error;
  const client = ctx.client as typeof ctx.client & {
    vault_shamir_initialized_at?: string | null;
    vault_shamir_version?: number | null;
  };
  return NextResponse.json({
    initialized: !!client.vault_shamir_initialized_at,
    initializedAt: client.vault_shamir_initialized_at ?? null,
    version: client.vault_shamir_version ?? null,
  });
}
