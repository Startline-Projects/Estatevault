import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { requireClientUser, b64encode, byteaToBytes, checkRate, limiters, logAudit } from "@/lib/api/crypto";

export const runtime = "nodejs";

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { user, profile, client, admin } = ctx;

  const rl = await checkRate(limiters.bundle, `bundle:${user.id}`);
  if (rl) return rl;

  if (!client.crypto_setup_at || !client.wrapped_mk_pass || !client.kdf_salt || !client.kdf_params) {
    return fail("crypto not bootstrapped", 404);
  }

  await logAudit(admin, { actor_id: profile.id, action: "crypto.bundle.fetch" });

  return ok({
    salt: b64encode(byteaToBytes(client.kdf_salt)),
    kdfParams: client.kdf_params,
    wrappedMkPass: b64encode(byteaToBytes(client.wrapped_mk_pass)),
    encVersion: client.enc_version ?? 1,
  });
});
