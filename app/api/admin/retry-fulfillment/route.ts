export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { type NextRequest } from "next/server";
import { getAppUrl } from "@/lib/config/appUrl";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient, requireAuth } from "@/lib/api/auth";
import { reconcilePaidOrder } from "@/lib/orders/reconcileOrder";

// Admin-triggered re-fulfillment for a paid-but-stuck order (BUG-1 / BUG-13).
// Re-runs the replay-safe checkout handler from the verified Stripe session —
// the right retry for orders with no document rows yet (webhook missed) or a
// failed generation. For orders whose document rows merely need regenerating,
// use /api/documents/regenerate-missing instead.
export const POST = withRoute(async (request: NextRequest) => {
  const auth = await requireAuth(["admin"], request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { order_id?: string };
  const orderId = body.order_id;
  if (!orderId) return fail("order_id required", 400);

  const admin = createAdminClient();
  // 1. Re-dispatch the handler from the verified Stripe session (creates doc
  //    rows + advances to `generating`, replay-safe).
  const outcome = await reconcilePaidOrder(admin, orderId);
  if (!outcome.ok) return fail(outcome.reason, 409);

  // 2. Trigger generation now so the admin gets a complete one-click fix. The
  //    generator only acts on `generating` and short-circuits locked/finished
  //    orders, so the attorney-review lock is respected.
  try {
    await fetch(`${getAppUrl()}/api/documents/process-now?order_id=${encodeURIComponent(orderId)}`, {
      method: "GET",
    });
  } catch (e) {
    console.error("[retry-fulfillment] generation trigger failed:", e instanceof Error ? e.message : e);
  }

  return ok({ ok: true, action: outcome.action });
});
