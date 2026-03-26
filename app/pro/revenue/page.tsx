"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface EarningsBreakdown {
  type: string;
  count: number;
  total: number;
}

interface PayoutRow {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

function getNextFriday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + daysUntilFriday);
  return nextFriday.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function payoutStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "Paid", cls: "bg-green-100 text-green-700" },
    pending: { label: "Pending", cls: "bg-yellow-100 text-yellow-700" },
    processing: { label: "Processing", cls: "bg-blue-100 text-blue-700" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function ProRevenuePage() {
  const [mtd, setMtd] = useState(0);
  const [lastMonth, setLastMonth] = useState(0);
  const [ytd, setYtd] = useState(0);
  const [allTime, setAllTime] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [breakdown, setBreakdown] = useState<EarningsBreakdown[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .eq("profile_id", user.id)
        .single();
      if (!partner) return;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      // Fetch all orders for this partner
      const { data: allOrders } = await supabase
        .from("orders")
        .select("id, product_type, partner_cut, status, created_at")
        .eq("partner_id", partner.id)
        .in("status", ["paid", "delivered", "generating", "review"]);

      const orders = allOrders || [];

      // MTD
      const mtdOrders = orders.filter((o) => o.created_at >= monthStart);
      const mtdTotal = mtdOrders.reduce((sum, o) => sum + (o.partner_cut || 0), 0);
      setMtd(mtdTotal);

      // Last month
      const lastMonthOrders = orders.filter(
        (o) => o.created_at >= lastMonthStart && o.created_at <= lastMonthEnd
      );
      setLastMonth(lastMonthOrders.reduce((sum, o) => sum + (o.partner_cut || 0), 0));

      // YTD
      const ytdOrders = orders.filter((o) => o.created_at >= yearStart);
      setYtd(ytdOrders.reduce((sum, o) => sum + (o.partner_cut || 0), 0));

      // All time
      setAllTime(orders.reduce((sum, o) => sum + (o.partner_cut || 0), 0));

      // Pending balance (orders that are paid/generating but not yet delivered)
      const pendingOrders = orders.filter((o) =>
        ["paid", "generating", "review"].includes(o.status)
      );
      setPendingBalance(
        pendingOrders.reduce((sum, o) => sum + (o.partner_cut || 0), 0)
      );

      // Breakdown by type
      const willOrders = orders.filter((o) => o.product_type === "will");
      const trustOrders = orders.filter((o) => o.product_type === "trust");
      const amendOrders = orders.filter((o) => o.product_type === "amendment");

      const bd: EarningsBreakdown[] = [];
      if (willOrders.length > 0) {
        bd.push({
          type: "Will Package",
          count: willOrders.length,
          total: willOrders.reduce((sum, o) => sum + (o.partner_cut || 0), 0),
        });
      }
      if (trustOrders.length > 0) {
        bd.push({
          type: "Trust Package",
          count: trustOrders.length,
          total: trustOrders.reduce((sum, o) => sum + (o.partner_cut || 0), 0),
        });
      }
      if (amendOrders.length > 0) {
        bd.push({
          type: "Document Amendment",
          count: amendOrders.length,
          total: amendOrders.reduce((sum, o) => sum + (o.partner_cut || 0), 0),
        });
      }
      setBreakdown(bd);

      // Payouts
      const { data: payoutData } = await supabase
        .from("payouts")
        .select("id, amount, status, created_at")
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setPayouts(payoutData || []);

      setLoading(false);
    }
    load();
  }, []);

  function dollars(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }

  if (loading) {
    return (
      <div className="max-w-5xl space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* MTD earnings header */}
      <div className="rounded-xl bg-navy p-6">
        <p className="text-sm text-white/60">Month-to-Date Earnings</p>
        <p className="mt-1 text-4xl font-bold text-white">{dollars(mtd)}</p>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "MTD", value: dollars(mtd) },
          { label: "Last Month", value: dollars(lastMonth) },
          { label: "YTD", value: dollars(ytd) },
          { label: "All Time", value: dollars(allTime) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white border border-gray-200 p-5">
            <p className="text-xs text-charcoal/50 uppercase tracking-wider">{s.label}</p>
            <p className="mt-2 text-2xl font-bold text-navy">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Earnings breakdown */}
      <div className="mt-6 rounded-xl bg-white border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-navy">Earnings Breakdown</h2>
        </div>
        {breakdown.length === 0 ? (
          <div className="p-6 text-center text-sm text-charcoal/50">
            No earnings data yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-navy">
                  Document Type
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-navy">
                  Count
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-navy">
                  Total Earnings
                </th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.type} className="border-b border-gray-100">
                  <td className="px-6 py-3 font-medium text-navy">{b.type}</td>
                  <td className="px-6 py-3 text-charcoal/70">{b.count}</td>
                  <td className="px-6 py-3 font-semibold text-green-600">
                    {dollars(b.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending balance */}
      <div className="mt-6 rounded-xl bg-gold/10 border border-gold/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-navy">Pending Balance</p>
            <p className="text-2xl font-bold text-navy mt-1">{dollars(pendingBalance)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-charcoal/50">Next payout</p>
            <p className="text-sm font-medium text-navy">{getNextFriday()}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-charcoal/50">
          Payouts are processed every Friday. Minimum payout is $50. Earnings below $50 roll
          to the following week.
        </p>
      </div>

      {/* Payout history */}
      <div className="mt-6 rounded-xl bg-white border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-navy">Payout History</h2>
        </div>
        {payouts.length === 0 ? (
          <div className="p-6 text-center text-sm text-charcoal/50">
            No payouts yet. Your first payout will arrive within 7 days of your first
            completed document.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-navy">
                  Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-navy">
                  Amount
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-navy">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="px-6 py-3 text-charcoal/70">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 font-semibold text-navy">
                    {dollars(p.amount)}
                  </td>
                  <td className="px-6 py-3">{payoutStatusBadge(p.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tax documents */}
      <div className="mt-6 rounded-xl bg-white border border-gray-200 p-6">
        <h2 className="text-base font-bold text-navy">Tax Documents</h2>
        <p className="mt-2 text-sm text-charcoal/50">
          1099 tax documents will be available here at the end of the tax year for partners
          who earned $600 or more.
        </p>
        <div className="mt-4 rounded-lg bg-gray-50 p-4 text-center">
          <p className="text-xs text-charcoal/40">No tax documents available yet.</p>
        </div>
      </div>
    </div>
  );
}
