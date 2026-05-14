"use client";

import { useState } from "react";
import Link from "next/link";

export interface RosterRow {
  id: string;
  code: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  stripeReady: boolean;
  clicks: number;
  conversions: number;
  conversionRate: number;
  earnedCents: number;
  paidCents: number;
  unpaidCents: number;
}

export interface OrderRow {
  id: string;
  product_type: string;
  amount_total: number;
  affiliate_cut: number;
  status: string;
  created_at: string;
  affiliate_id: string;
  affiliate_name: string;
}

export interface PayoutRow {
  id: string;
  affiliate_id: string;
  affiliate_name: string;
  amount_cents: number;
  status: string;
  stripe_transfer_id: string | null;
  paid_at: string | null;
  created_at: string;
}

type TabKey = "roster" | "orders" | "payouts";

const TABS: { key: TabKey; label: string }[] = [
  { key: "roster", label: "Affiliate Roster" },
  { key: "orders", label: "All Attributed Orders" },
  { key: "payouts", label: "Payouts Ledger" },
];

const AFFILIATE_STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending_onboarding: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
};

const PAYOUT_STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  reversed: "bg-gray-100 text-gray-500",
};

function fmtDollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ");
}

const TH =
  "text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";
const THR = TH + " text-right";

export default function AffiliateAdminTabs({
  roster,
  orders,
  payouts,
}: {
  roster: RosterRow[];
  orders: OrderRow[];
  payouts: PayoutRow[];
}) {
  const [tab, setTab] = useState<TabKey>("roster");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0 -mb-px">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${
                tab === t.key
                  ? "border-gold text-navy"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ROSTER ── */}
      {tab === "roster" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {roster.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              No affiliates have signed up yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className={TH}>Affiliate</th>
                    <th className={TH}>Status</th>
                    <th className={THR}>Clicks</th>
                    <th className={THR}>Conv.</th>
                    <th className={THR}>Conv. Rate</th>
                    <th className={THR}>Earned</th>
                    <th className={THR}>Unpaid</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-charcoal">{r.full_name}</p>
                        <p className="text-xs text-gray-400">
                          {r.email} ·{" "}
                          <span className="font-mono">{r.code}</span>
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            AFFILIATE_STATUS_STYLES[r.status] ||
                            "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {r.clicks.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {r.conversions.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {(r.conversionRate * 100).toFixed(1)}%
                      </td>
                      <td className="px-5 py-3 text-right text-charcoal">
                        {fmtDollars(r.earnedCents)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gold">
                        {fmtDollars(r.unpaidCents)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/sales/affiliates/${r.id}`}
                          className="text-xs font-semibold text-navy hover:text-gold transition"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ORDERS ── */}
      {tab === "orders" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {orders.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              No affiliate-attributed orders yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className={TH}>Date</th>
                    <th className={TH}>Affiliate</th>
                    <th className={TH}>Product</th>
                    <th className={TH}>Status</th>
                    <th className={THR}>Order Total</th>
                    <th className={THR}>Affiliate Cut</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {fmtDate(o.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/sales/affiliates/${o.affiliate_id}`}
                          className="font-medium text-navy hover:text-gold transition"
                        >
                          {o.affiliate_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 capitalize text-charcoal">
                        {o.product_type}
                      </td>
                      <td className="px-5 py-3 capitalize text-gray-500">
                        {o.status}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {fmtDollars(o.amount_total)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gold">
                        {fmtDollars(o.affiliate_cut)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PAYOUTS ── */}
      {tab === "payouts" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {payouts.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              No payouts have been sent yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className={TH}>Date</th>
                    <th className={TH}>Affiliate</th>
                    <th className={THR}>Amount</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Stripe Transfer</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {fmtDate(p.paid_at || p.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/sales/affiliates/${p.affiliate_id}`}
                          className="font-medium text-navy hover:text-gold transition"
                        >
                          {p.affiliate_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gold">
                        {fmtDollars(p.amount_cents)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            PAYOUT_STATUS_STYLES[p.status] ||
                            "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-400">
                        {p.stripe_transfer_id || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
