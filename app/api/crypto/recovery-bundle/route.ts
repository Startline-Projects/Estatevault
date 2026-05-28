import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { requireClientUser, b64encode, byteaToBytes, checkRate, limiters, logAudit } from "@/lib/api/crypto";

export const runtime = "nodejs";

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { user, profile, client, admin } = ctx;

  const rl = await checkRate(limiters.recovery, `recovery:${user.id}`);
  if (rl) return rl;

  if (!client.crypto_setup_at || !client.wrapped_mk_recovery) {
    return fail("crypto not bootstrapped", 404);
  }

  await logAudit(admin, {
    actor_id: profile.id,
    action: "crypto.recovery_bundle.fetch",
    meta: { sensitive: true },
  });

  return ok({
    wrappedMkRecovery: b64encode(byteaToBytes(client.wrapped_mk_recovery)),
    encVersion: client.enc_version ?? 1,
  });
});
