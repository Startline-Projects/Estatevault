"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getOrdersMissingDocs } from "@/lib/api-client/sales";
import { regenerateMissing, retryFulfillment } from "@/lib/api-client/documents";

type FailureKind = "webhook_missed" | "queue_failed" | "partially_delivered" | "missing_docs";

type OrderRow = {
  orderId: string;
  productType: string;
  status: string;
  createdAt: string;
  clientEmail: string | null;
  clientName: string | null;
  expected: string[];
  present: string[];
  missing: string[];
  hasPendingRows: boolean;
  isAttorneyReview: boolean;
  failureKind?: FailureKind;
};

const FAILURE_BADGE: Record<FailureKind, { label: string; cls: string }> = {
  webhook_missed: { label: "Paid · not fulfilled", cls: "bg-red-100 text-red-800" },
  queue_failed: { label: "Generation failed", cls: "bg-red-100 text-red-800" },
  partially_delivered: { label: "Partially delivered", cls: "bg-amber-100 text-amber-800" },
  missing_docs: { label: "Missing documents", cls: "bg-amber-100 text-amber-800" },
};

type RegenState = "idle" | "running" | "ok" | "error";

const DOC_LABELS: Record<string, string> = {
  will: "Will",
  trust: "Trust",
  pour_over_will: "Pour-Over Will",
  poa: "Power of Attorney",
  healthcare_directive: "Healthcare Directive",
};

// Turn a raw generation error (often an Anthropic API JSON blob) into a short,
// admin-friendly sentence with the action to take. Never surface raw JSON.
function friendlyGenError(raw?: string): string {
  const r = (raw || "").toLowerCase();
  if (r.includes("credit balance is too low") || r.includes("plans & billing") || r.includes("purchase credits")) {
    return "Anthropic API is out of credits. Top up at console.anthropic.com → Plans & Billing, then retry.";
  }
  if (r.includes("authentication") || r.includes("invalid x-api-key") || r.includes("api key") || r.includes("anthropic_api_key")) {
    return "Anthropic API key is missing or invalid. Check the ANTHROPIC_API_KEY setting.";
  }
  if (r.includes("rate") && r.includes("limit")) {
    return "Hit the Anthropic API rate limit. Wait a moment, then retry.";
  }
  if (r.includes("overloaded") || r.includes("529")) {
    return "Anthropic API is temporarily overloaded. Retry in a minute.";
  }
  if (r.includes("no intake") || r.includes("intake answers")) {
    return "Missing intake answers for this order — documents can't be rebuilt automatically.";
  }
  return "Document generation failed. Please retry; if it persists, check the generator status.";
}

// Pull the first real failure reason out of a regenerate-missing response.
function firstFailureReason(d?: Record<string, unknown>): string | undefined {
  const results = (d?.results as Array<{ success?: boolean; error?: string }> | undefined) || [];
  return results.find((x) => x && x.success === false)?.error;
}

export default function RegenerateDocsPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [state, setState] = useState<Record<string, { stage: RegenState; message?: string }>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await getOrdersMissingDocs();
      if (error) {
        setLoadError(error);
        setOrders([]);
      } else {
        setOrders((data?.orders || []) as OrderRow[]);
      }
    } catch {
      setLoadError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function regenerate(order: OrderRow) {
    const orderId = order.orderId;
    setState((s) => ({ ...s, [orderId]: { stage: "running" } }));
    try {
      // Orders with no document rows yet (webhook missed / generation failed)
      // must re-run full fulfillment from the Stripe session; orders that just
      // need their existing doc rows rebuilt use regenerate-missing.
      const needsFullRefulfill =
        order.failureKind === "webhook_missed" || order.failureKind === "queue_failed";

      if (needsFullRefulfill) {
        const result = await retryFulfillment(orderId);
        if (result.error) {
          setState((s) => ({ ...s, [orderId]: { stage: "error", message: friendlyGenError(result.error) } }));
          return;
        }
        setState((s) => ({ ...s, [orderId]: { stage: "ok", message: "Fulfillment re-run queued." } }));
        setTimeout(() => loadOrders(), 1200);
        return;
      }

      const result = await regenerateMissing(orderId);
      const d = result.data as Record<string, unknown> | undefined;
      if (result.error) {
        setState((s) => ({ ...s, [orderId]: { stage: "error", message: friendlyGenError(result.error) } }));
        return;
      }
      const regenerated = (d?.regenerated as number) ?? (d?.documents_generated as number) ?? 0;
      const failed = (d?.failed as number) ?? 0;
      if (failed > 0 || regenerated === 0) {
        // Some/all documents failed — show the friendly reason, not raw JSON.
        setState((s) => ({ ...s, [orderId]: { stage: "error", message: friendlyGenError(firstFailureReason(d)) } }));
        return;
      }
      setState((s) => ({
        ...s,
        [orderId]: { stage: "ok", message: `Regenerated ${regenerated} document(s).` },
      }));
      setTimeout(() => loadOrders(), 800);
    } catch (e) {
      setState((s) => ({
        ...s,
        [orderId]: { stage: "error", message: friendlyGenError(e instanceof Error ? e.message : String(e)) },
      }));
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/sales/dashboard" className="text-xs text-charcoal/50 hover:text-navy">
            ← Back to Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-navy">Order Fulfillment</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Paid orders that are stuck — webhook missed, generation failed, or missing PDFs.
            Click Retry to re-run fulfillment for that order.
          </p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loadError && (
        <div className="mt-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!loading && !loadError && orders.length === 0 && (
        <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-charcoal/60">No orders with missing documents. All clear.</p>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {orders.map((o) => {
          const s = state[o.orderId];
          return (
            <div key={o.orderId} className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-semibold text-navy uppercase tracking-wide">
                      {o.productType}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-charcoal/70">
                      {o.status}
                    </span>
                    {o.failureKind && (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${FAILURE_BADGE[o.failureKind].cls}`}>
                        {FAILURE_BADGE[o.failureKind].label}
                      </span>
                    )}
                    {o.isAttorneyReview && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                        Attorney review
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-navy break-all">
                    {o.clientName || "—"}
                    {o.clientEmail && <span className="text-charcoal/50 font-normal"> · {o.clientEmail}</span>}
                  </p>
                  <p className="mt-1 text-xs text-charcoal/50 break-all">
                    Order {o.orderId} · {new Date(o.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(o.expected ?? o.missing).map((t) => {
                      const sent = (o.present ?? []).includes(t);
                      return (
                        <span
                          key={t}
                          className={
                            sent
                              ? "rounded-md bg-green-50 border border-green-200 px-2 py-1 text-xs text-green-700"
                              : "rounded-md bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700"
                          }
                        >
                          {sent ? "✓ Sent" : "✗ Missing"}: {DOC_LABELS[t] || t}
                        </span>
                      );
                    })}
                  </div>
                  {(o.present?.length ?? 0) > 0 && (
                    <p className="mt-2 text-xs text-charcoal/50">
                      {o.present.length} of {o.expected?.length ?? o.present.length + o.missing.length} documents delivered
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    onClick={() => regenerate(o)}
                    disabled={s?.stage === "running"}
                    className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50"
                  >
                    {s?.stage === "running"
                      ? "Retrying..."
                      : o.failureKind === "webhook_missed" || o.failureKind === "queue_failed"
                        ? "Retry Fulfillment"
                        : "Regenerate Missing"}
                  </button>
                  {s?.stage === "ok" && (
                    <span className="text-xs font-medium text-green-700">{s.message}</span>
                  )}
                  {s?.stage === "error" && (
                    <span className="text-xs font-medium text-red-700">{s.message}</span>
                  )}
                </div>
              </div>

              {s?.stage === "error" && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {s.message}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
