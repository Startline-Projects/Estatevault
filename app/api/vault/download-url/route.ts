import { NextRequest } from "next/server";
import { requireClientUser } from "@/lib/api/crypto";
import { apiRateLimit } from "@/lib/rate-limit";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as farewellRepo from "@/lib/repos/server/farewellRepo";
import { vaultDownloadUrlSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

const TTL_S = 60 * 5;

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  const rl = await apiRateLimit.limit(`download-url:${user.id}`);
  if (!rl.success) return fail("rate limited", 429);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("bad json", 400); }
  const parsed = vaultDownloadUrlSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);

  // Path scoping: must start with vault/<client.id>/ to prevent enumeration.
  const expectedPrefix = `vault/${client.id}/`;
  if (!parsed.data.path.startsWith(expectedPrefix)) {
    return fail("forbidden", 403);
  }

  if (parsed.data.bucket === "farewell-videos") {
    const { data: msg } = await farewellRepo.findByStoragePath(admin, parsed.data.path);
    if (!msg || msg.client_id !== client.id) {
      return fail("forbidden", 403);
    }
  }

  const { data, error } = await admin.storage
    .from(parsed.data.bucket)
    .createSignedUrl(parsed.data.path, TTL_S);
  if (error || !data) {
    return fail("failed to mint signed url", 500);
  }

  return ok({ signedUrl: data.signedUrl, expiresInSec: TTL_S });
});
