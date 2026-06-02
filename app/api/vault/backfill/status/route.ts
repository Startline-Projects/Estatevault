import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as vaultItemRepo from "@/lib/repos/server/vaultItemRepo";
import * as trusteeRepo from "@/lib/repos/server/trusteeRepo";
import * as farewellRepo from "@/lib/repos/server/farewellRepo";

export const runtime = "nodejs";

export const GET = withRoute(async () => {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const admin = auth.admin;
  const { data: client } = await clientRepo.getBackfillStateByProfile(admin, user.id);
  if (!client) return fail("no client", 404);

  // User hasn't bootstrapped E2EE yet (no PIN) — nothing to backfill. Auto-generated
  // server-side rows (will/trust PDFs from Stripe webhook + doc processor) live as
  // plaintext intentionally and should not surface the banner.
  if (!client.crypto_setup_at) {
    return ok({
      bootstrapped: false,
      completedAt: null,
      complete: true,
      remaining: { vault_items: 0, vault_trustees: 0, farewell_messages: 0 },
      totalRemaining: 0,
    });
  }

  const counts = await Promise.all([
    vaultItemRepo.countUnencrypted(admin, client.id),
    trusteeRepo.countUnencrypted(admin, client.id),
    farewellRepo.countUnencrypted(admin, client.id),
  ]);

  const remaining = {
    vault_items: counts[0].count ?? 0,
    vault_trustees: counts[1].count ?? 0,
    farewell_messages: counts[2].count ?? 0,
  };
  const totalRemaining = remaining.vault_items + remaining.vault_trustees + remaining.farewell_messages;
  const complete = totalRemaining === 0;

  // Auto-mark client complete the first time we observe zero remaining.
  if (complete && client.crypto_setup_at && !client.crypto_backfill_complete_at) {
    await clientRepo.markBackfillComplete(admin, client.id);
  }

  return ok({
    bootstrapped: !!client.crypto_setup_at,
    completedAt: client.crypto_backfill_complete_at,
    complete,
    remaining,
    totalRemaining,
  });
});
