import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { admin, user, profile, client } = ctx;

  const rl = await checkRate(limiters.rotate, `rotate-rec:${user.id}`);
  if (rl) return rl;

  if (!client.crypto_setup_at) {
    return NextResponse.json({ error: "crypto not bootstrapped" }, { status: 409 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = RotateRecoverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  let wrappedRec: Uint8Array;
  try {
    wrappedRec = b64decode(parsed.data.wrappedMkRecovery);
  } catch {
    return NextResponse.json({ error: "bad base64" }, { status: 400 });
  }
  try {
    validateEnvelope(wrappedRec, MAX_WRAPPED);
  } catch (e) {
    return NextResponse.json({ error: `envelope invalid: ${(e as Error).message}` }, { status: 400 });
  }

  const { error } = await admin
    .from("clients")
    .update({ wrapped_mk_recovery: bytesToBytea(wrappedRec) })
    .eq("id", client.id);

  if (error) {
    return NextResponse.json({ error: "db update failed" }, { status: 500 });
  }

  await logAudit(admin, {
    actor_id: profile.id,
    action: "crypto.rotate_recovery",
    meta: { client_id: client.id, sensitive: true },
  });

  return NextResponse.json({ ok: true });
}
