"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface PartnerRow {
  id: string;
  company_name: string;
}

interface OrderRow {
  amount_total: number;
  partner_id: string;
  created_at: string;
}

interface BreakdownRow {
  partnerName: string;
  mtdRevenue: number;
  commission: number;
}

interface HistoryRow {
  month: string;
  partnerRevenue: number;
  commission: number;
  status: "Paid" | "Pending";
}

const COMMISSION_RATE = 0.05;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function SalesCommissionPage() {
  const [loading, setLoading] = useState(true);
  const [mtdCommission, setMtdCommission] = useState(0);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch rep's partners
      const { data: partners } = await supabase
        .from("partners")
        .select("id, company_name")
        .eq("created_by", user.id);

      if (!partners || partners.length === 0) {
        setLoading(false);
        return;
      }

      const typedPartners = partners as PartnerRow[];
      const partnerIds = typedPartners.map((p) => p.id);
      const partnerMap = new Map(typedPartners.map((p) => [p.id, p.company_name]));

      // Fetch orders from last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from("orders")
        .select("amount_total, partner_id, created_at")
        .in("partner_id", partnerIds)
        .gte("created_at", sixMonthsAgo.toISOString());

      const typedOrders = (orders || []) as OrderRow[];

      // MTD breakdown
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const mtdOrders = typedOrders.filter((o) => new Date(o.created_at) >= monthStart);

      const revenueByPartner = new Map<string, number>();
      for (const o of mtdOrders) {
        const prev = revenueByPartner.get(o.partner_id) || 0;
        revenueByPartner.set(o.partner_id, prev + (o.amount_total || 0));
      }

      const breakdownRows: BreakdownRow[] = [];
      let totalMtdRevenue = 0;
      revenueByPartner.forEach((totalCents, partnerId) => {
        const dollars = totalCents / 100;
        totalMtdRevenue += dollars;
        breakdownRows.push({
          partnerName: partnerMap.get(partnerId) || "Unknown",
          mtdRevenue: dollars,
          commission: dollars * COMMISSION_RATE,
        });
      });
      // Include partners with no revenue this month
      for (const p of typedPartners) {
        if (!revenueByPartner.has(p.id)) {
          breakdownRows.push({
            partnerName: p.company_name,
            mtdRevenue: 0,
            commission: 0,
          });
        }
      }
      breakdownRows.sort((a, b) => b.mtdRevenue - a.mtdRevenue);
      setBreakdown(breakdownRows);
      setMtdCommission(totalMtdRevenue * COMMISSION_RATE);

      // History: last 6 months
      const historyRows: HistoryRow[] = [];
      for (let i = 0; i < 6; i++) {
        const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const monthOrders = typedOrders.filter((o) => {
          const d = new Date(o.created_at);
          return d >= mDate && d < mEnd;
        });
        const partnerRevenue = monthOrders.reduce((sum, o) => sum + (o.amount_total || 0), 0) / 100;
        const isCurrentMonth = i === 0;
        historyRows.push({
          month: getMonthLabel(mDate),
          partnerRevenue,
          commission: partnerRevenue * COMMISSION_RATE,
          status: isCurrentMonth ? "Pending" : "Paid",
        });
      }
      setHistory(historyRows);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* MTD Commission Header */}
      <div className="bg-navy rounded-xl p-6 text-white">
        <p className="text-sm font-medium text-white/60 uppercase tracking-wide">
          My MTD Commission
        </p>
        <p className="text-4xl font-bold mt-2">{formatCurrency(mtdCommission)}</p>
        <p className="text-sm text-white/50 mt-1">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-gold/10 border border-gold/30 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-navy mb-1">How Commission Works</h3>
        <p className="text-sm text-charcoal leading-relaxed">
          You earn a <span className="font-semibold">5% commission</span> on all revenue generated by partners you
          recruit. Commission is calculated on the total order amount for each partner in your portfolio. Commissions
          are processed and paid monthly.
        </p>
      </div>

      {/* Commission Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal">MTD Commission Breakdown</h2>
        </div>
        {breakdown.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No partner data available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Partner
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    MTD Revenue
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Your Commission
                  </th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr
                    key={row.partnerName}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-charcoal">{row.partnerName}</td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {formatCurrency(row.mtdRevenue)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-navy">
                      {formatCurrency(row.commission)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-5 py-3 text-charcoal">Total</td>
                  <td className="px-5 py-3 text-right text-charcoal">
                    {formatCurrency(breakdown.reduce((s, r) => s + r.mtdRevenue, 0))}
                  </td>
                  <td className="px-5 py-3 text-right text-navy">
                    {formatCurrency(mtdCommission)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commission History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal">Commission History (Last 6 Months)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Month
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Partner Revenue
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  My Commission
                </th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr
                  key={row.month}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-charcoal">{row.month}</td>
                  <td className="px-5 py-3 text-right text-gray-600">
                    {formatCurrency(row.partnerRevenue)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-navy">
                    {formatCurrency(row.commission)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.status === "Paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Processing Note */}
      <p className="text-xs text-gray-400 text-center">
        Commissions are calculated on partner order totals and processed on the 1st of each month. Payments are
        deposited within 5 business days of processing.
      </p>
    </div>
  );
}
