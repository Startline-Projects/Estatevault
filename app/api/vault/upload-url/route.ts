import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { requireClientUser } from "@/lib/api/crypto";
import { apiRateLimit } from "@/lib/rate-limit";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import { vaultUploadUrlSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

// Mint a signed upload URL. Client PUTs opaque ciphertext (.bin) — encryption is
// client-side with the per-user FILES key (Option A / F2). Server only scopes the
// path + size; content is opaque.

const SIZE_LIMITS = {
  document: 20 * 1024 * 1024,
  farewell: 500 * 1024 * 1024,
};
const BUCKETS = { document: "documents", farewell: "farewell-videos" };
const SIGNED_URL_TTL_S = 60 * 5;

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  const rl = await apiRateLimit.limit(`upload-url:${user.id}`);
  if (!rl.success) return fail("rate limited", 429);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("bad json", 400); }
  const parsed = vaultUploadUrlSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);

  const { kind } = parsed.data;
  if (parsed.data.expectedSize && parsed.data.expectedSize > SIZE_LIMITS[kind]) {
    return fail("file too large", 413);
  }

  const { data: sub } = await clientRepo.getSubscriptionById(admin, client.id);
  if (!clientRepo.hasVaultAccess(sub?.vault_subscription_status, sub?.vault_subscription_expiry)) {
    return fail("Vault subscription required", 403);
  }

  const uploadId = parsed.data.uploadId ?? randomUUID();
  const path = `vault/${client.id}/${uploadId}.bin`;
  const bucket = BUCKETS[kind];

  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    return fail("failed to mint signed url", 500);
  }

  return ok({
    bucket,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    expiresInSec: SIGNED_URL_TTL_S,
    sizeLimit: SIZE_LIMITS[kind],
  });
});
