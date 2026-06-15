// Reconciliation cron for paid-but-unfulfilled orders (BUG-1 / BUG-13).
//
// The real safety net for "customer paid but never got documents." It checks
// the END RESULT — are the finished PDFs there? — independent of which
// generation path ran (the optional Redis queue, the synchronous success-page
// processNow, or the daily sweep). For each stuck order it:
//   1. advances paid orders that never ran the webhook handler (pending/failed)
//      by re-dispatching the replay-safe handler from the verified Stripe
//      session, then
//   2. triggers document generation for orders sitting in `generating` with
//      missing PDFs, then
//   3. alerts the admin about anything still unfinished past a threshold.
//
// It never touches the attorney-review lock: process-now short-circuits
// `review`/`delivered`, and the handler never downgrades those states.

import { type NextRequest } from "next/server";
import { getAppUrl } from "@/lib/config/appUrl";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import { reconcilePaidOrder } from "@/lib/orders/reconcileOrder";
import { sendFulfillmentFailureAlert } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EXPECTED_DOCS: Record<string, string[]> = {
  will: ["will", "poa", "healthcare_directive"],
  trust: ["trust", "pour_over_will", "poa", "healthcare_directive"],
};

// Only act on orders old enough that the normal paths have had their chance.
const RETRY_AFTER_MINUTES = 15;
// Alert about anything still unfinished this long after payment.
const ALERT_AFTER_MINUTES = 60;
// A `pending` order with no Stripe session this long after creation never got a
// checkout page built (BUG-9: session creation failed) — it is a dead orphan,
// safe to delete. Well beyond the millisecond window of a normal in-flight
// checkout, so a live request can never be caught.
const ORPHAN_AFTER_MINUTES = 30;

type Admin = ReturnType<typeof createAdminClient>;

// Kick the public, idempotent generator. Safe to call repeatedly: it only
// generates orders in `generating` and short-circuits finished ones.
async function triggerGeneration(orderId: string) {
  try {
    await fetch(`${getAppUrl()}/api/documents/process-now?order_id=${encodeURIComponent(orderId)}`, {
      method: "GET",
    });
  } catch (e) {
    console.error("[reconcile-orders] generation trigger failed:", e instanceof Error ? e.message : e);
  }
}

// True when every expected document for the order has an uploaded file.
async function hasAllFinishedDocs(admin: Admin, orderId: string, productType: string) {
  const expected = EXPECTED_DOCS[productType] || [];
  if (!expected.length) return true;
  const { data: docs } = await admin
    .from("documents")
    .select("document_type, storage_path")
    .eq("order_id", orderId);
  const ready = new Set((docs || []).filter((d) => d.storage_path).map((d) => d.document_type));
  return expected.every((t) => ready.has(t));
}

export const GET = withRoute(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return fail("unauthorized", 401);
  }

  const admin = createAdminClient();
  const now = Date.now();
  const retryBefore = new Date(now - RETRY_AFTER_MINUTES * 60_000).toISOString();

  // Paid-but-stuck across the whole fulfillment lifecycle, for document
  // products, with a Stripe session so we can verify payment.
  //  - pending: handler never advanced it (webhook missed)            → BUG-1
  //  - failed:  an explicit failure was recorded                      → BUG-13
  //  - generating: ran but PDFs not finished (queue/processNow gap)   → BUG-13
  //  - review: attorney-locked but PDFs missing (rare)                → surface only
  const { data: stuck, error } = await admin
    .from("orders")
    .select("id, status, product_type, created_at, stripe_session_id")
    .in("product_type", ["will", "trust"])
    .in("status", ["pending", "failed", "generating", "review"])
    .not("stripe_session_id", "is", null)
    .lt("created_at", retryBefore)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[reconcile-orders] query failed:", error);
    return fail("query failed", 500);
  }

  let advanced = 0;
  let generationTriggered = 0;
  let healthy = 0;
  let alerted = 0;

  for (const o of stuck || []) {
    // If the finished PDFs are already present, nothing is wrong — skip.
    if (await hasAllFinishedDocs(admin, o.id, o.product_type)) {
      healthy++;
      continue;
    }

    // 1. Orders that never ran the handler: re-dispatch it (creates document
    //    rows, advances to `generating`, replay-safe). Verifies payment first.
    if (o.status === "pending" || o.status === "failed") {
      const outcome = await reconcilePaidOrder(admin, o.id).catch((e) => ({
        ok: false as const,
        reason: e instanceof Error ? e.message : "unknown",
      }));
      if (outcome.ok) advanced++;
    }

    // 2. Trigger generation for any non-locked order still missing PDFs. The
    //    generator only acts on `generating` and short-circuits locked/finished
    //    orders, so this respects the attorney-review lock.
    if (o.status !== "review") {
      await triggerGeneration(o.id);
      generationTriggered++;
    }

    // 3. Alert on anything still unfinished past the threshold.
    const ageMs = now - new Date(o.created_at ?? now).getTime();
    if (ageMs >= ALERT_AFTER_MINUTES * 60_000) {
      try {
        await sendFulfillmentFailureAlert({
          orderId: o.id,
          productType: o.product_type,
          reason: o.status === "review" ? "attorney_review_missing_docs" : "missing_documents",
          detail: `status=${o.status}, age=${Math.round(ageMs / 60_000)}min`,
        });
        alerted++;
      } catch (alertErr) {
        console.error("[reconcile-orders] alert failed:", alertErr);
      }
    }
  }

  // ── BUG-9: sweep orphan pending orders ──────────────────────
  // Orders left `pending` with no stripe_session_id (Stripe session creation
  // failed). Excluded from the query above (it requires a session id), so they
  // would otherwise accumulate forever. Count + log before deleting — never a
  // silent mass delete.
  let orphansDeleted = 0;
  const orphanBefore = new Date(now - ORPHAN_AFTER_MINUTES * 60_000).toISOString();
  const { data: orphans, error: orphanErr } = await admin
    .from("orders")
    .select("id")
    .eq("status", "pending")
    .is("stripe_session_id", null)
    .lt("created_at", orphanBefore)
    .limit(500);

  if (orphanErr) {
    console.error("[reconcile-orders] orphan query failed:", orphanErr);
  } else if (orphans && orphans.length) {
    const ids = orphans.map((o) => o.id);
    console.log(`[reconcile-orders] deleting ${ids.length} orphan pending orders (BUG-9):`, ids);
    const { error: delErr } = await admin.from("orders").delete().in("id", ids);
    if (delErr) {
      console.error("[reconcile-orders] orphan delete failed:", delErr);
    } else {
      orphansDeleted = ids.length;
    }
  }

  // ── BUG-32: downgrade expired "active" subscriptions ────────
  // If the renewal webhook never arrived, status stays "active" with a past
  // expiry. After a 3-day grace period (matching hasVaultAccess), flip to
  // "expired" so records stay honest.
  let subsExpired = 0;
  const graceCutoff = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: expiredClients, error: expErr } = await admin
    .from("clients")
    .select("id")
    .eq("vault_subscription_status", "active")
    .not("vault_subscription_expiry", "is", null)
    .lt("vault_subscription_expiry", graceCutoff)
    .limit(200);

  if (expErr) {
    console.error("[reconcile-orders] expired sub query failed:", expErr);
  } else if (expiredClients && expiredClients.length) {
    const ids = expiredClients.map((c) => c.id);
    console.log(`[reconcile-orders] expiring ${ids.length} stale-active subscriptions (BUG-32):`, ids);
    const { error: upErr } = await admin
      .from("clients")
      .update({ vault_subscription_status: "expired" })
      .in("id", ids);
    if (upErr) {
      console.error("[reconcile-orders] sub expiry update failed:", upErr);
    } else {
      subsExpired = ids.length;
    }
  }

  return ok({
    ok: true,
    checked: stuck?.length || 0,
    healthy,
    advanced,
    generationTriggered,
    alerted,
    orphansDeleted,
    subsExpired,
  });
});
