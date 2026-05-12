import { NextRequest, NextResponse } from "next/server";
import { requireClientUser, b64encode, byteaToBytes, checkRate, limiters, logAudit } from "@/lib/api/crypto";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { user, profile, client, admin } = ctx;

  // Stricter rate limit: recovery bundle is the catastrophic-loss vector.
  const rl = await checkRate(limiters.recovery, `recovery:${user.id}`);
  if (rl) return rl;

  if (!client.crypto_setup_at || !client.wrapped_mk_recovery) {
    return NextResponse.json({ error: "crypto not bootstrapped" }, { status: 404 });
  }

  await logAudit(admin, {
    actor_id: profile.id,
    action: "crypto.recovery_bundle.fetch",
    meta: { sensitive: true },
  });

  return NextResponse.json({
    wrappedMkRecovery: b64encode(byteaToBytes(client.wrapped_mk_recovery)),
    encVersion: client.enc_version ?? 1,
  });
}
