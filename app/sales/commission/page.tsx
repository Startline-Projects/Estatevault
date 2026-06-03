"use client";

import { useState, useEffect } from "react";
import { getMyProfile } from "@/lib/api-client/profile";
import { getCommission, getMyPlatformCommission } from "@/lib/api-client/sales";

interface BreakdownRow {
  partnerName: string;
  platformFee: number;
  commission: number;
  paidAt: string;
  status: "Paid" | "Pending";
}

interface HistoryRow {
  month: string;
  platformFees: number;
  commission: number;
  status: "Paid" | "Pending";
}

// Admin view: per-rep commission summary
interface RepSummaryRow {
  repId: string;
  repName: string;
  repEmail: string;
  commissionRate: number;
  mtdPlatformFees: number;
  mtdCommissionOwed: number;
  totalPartners: number;
  mtdPartners: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

// ─── ADMIN VIEW ────────────────────────────────────────────────────────────────
function AdminCommissionView() {
  const [loading, setLoading] = useState(true);
  const [repSummaries, setRepSummaries] = useState<RepSummaryRow[]>([]);
  const [totalMtdOwed, setTotalMtdOwed] = useState(0);
  const [totalMtdFees, setTotalMtdFees] = useState(0);

  useEffect(() => {
    async function load() {
      // Data now comes from the API boundary (B2).
      const { data } = await getCommission();
      setRepSummaries((data?.repSummaries ?? []) as unknown as RepSummaryRow[]);
      setTotalMtdOwed(data?.totalMtdOwed ?? 0);
      setTotalMtdFees(data?.totalMtdFees ?? 0);
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
      {/* Header */}
      <div className="bg-navy rounded-xl p-6 text-white">
        <p className="text-sm font-medium text-white/60 uppercase tracking-wide">Sales Rep Commissions — Total Owed This Month</p>
        <p className="text-4xl font-bold mt-2">{formatCurrency(totalMtdOwed)}</p>
        <p className="text-sm text-white/50 mt-1">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} across {repSummaries.filter(r => r.mtdCommissionOwed > 0).length} sales rep{repSummaries.filter(r => r.mtdCommissionOwed > 0).length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-gold/10 border border-gold/30 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-navy mb-1">About Sales Rep Commissions</h3>
        <p className="text-sm text-charcoal leading-relaxed">
          This page tracks commissions owed to <span className="font-semibold">sales reps</span> (internal team members
          who recruit partners) — not partners themselves. Each sales rep earns their configured rate on the white-label
          platform fee paid by partners they sign up. Commission is earned at partner signup payment, not on document
          sales, and is paid out on the 1st of each month.
        </p>
      </div>

      {/* Rep Breakdown Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal">MTD Commission Owed by Rep</h2>
        </div>
        {repSummaries.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No sales reps found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales Rep</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">MTD Partners</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">MTD Platform Fees</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Commission Owed</th>
                </tr>
              </thead>
              <tbody>
                {repSummaries.map((rep) => (
                  <tr key={rep.repId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-charcoal">{rep.repName}</p>
                      <p className="text-xs text-gray-400">{rep.repEmail}</p>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-navy/10 text-navy">
                        {(rep.commissionRate * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{rep.mtdPartners}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(rep.mtdPlatformFees)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-navy">{formatCurrency(rep.mtdCommissionOwed)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-5 py-3 text-charcoal" colSpan={3}>Total</td>
                  <td className="px-5 py-3 text-right text-charcoal">{formatCurrency(totalMtdFees)}</td>
                  <td className="px-5 py-3 text-right text-navy">{formatCurrency(totalMtdOwed)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Commissions are earned on partner platform fees only and processed on the 1st of each month.
      </p>
    </div>
  );
}

// ─── SALES REP VIEW ────────────────────────────────────────────────────────────
function RepCommissionView() {
  const [loading, setLoading] = useState(true);
  const [commissionRate, setCommissionRate] = useState(0.5);
  const [mtdCommission, setMtdCommission] = useState(0);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await getMyPlatformCommission();
      if (data) {
        setCommissionRate(data.commissionRate);
        setMtdCommission(data.mtdCommission);
        setBreakdown(data.breakdown as BreakdownRow[]);
        setHistory(data.history as HistoryRow[]);
      }
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
      <div className="bg-navy rounded-xl p-6 text-white">
        <p className="text-sm font-medium text-white/60 uppercase tracking-wide">My MTD Commission</p>
        <p className="text-4xl font-bold mt-2">{formatCurrency(mtdCommission)}</p>
        <p className="text-sm text-white/50 mt-1">
          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="bg-gold/10 border border-gold/30 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-navy mb-1">How Commission Works</h3>
        <p className="text-sm text-charcoal leading-relaxed">
          You earn a <span className="font-semibold">{(commissionRate * 100).toFixed(0)}% commission</span> on
          the white-label platform fee paid by partners you recruit. Commission is earned when a partner
          completes their signup payment, not on document sales. Commissions are processed and paid monthly.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal">MTD Partner Signups</h2>
        </div>
        {breakdown.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No partner signups this month yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Partner</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Signed Up</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Platform Fee</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Commission</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.partnerName} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-charcoal">{row.partnerName}</td>
                    <td className="px-5 py-3 text-gray-600">{row.paidAt}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(row.platformFee)}</td>
                    <td className="px-5 py-3 text-right font-medium text-navy">{formatCurrency(row.commission)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${row.status === "Paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-5 py-3 text-charcoal" colSpan={2}>Total</td>
                  <td className="px-5 py-3 text-right text-charcoal">{formatCurrency(breakdown.reduce((s, r) => s + r.platformFee, 0))}</td>
                  <td className="px-5 py-3 text-right text-navy">{formatCurrency(mtdCommission)}</td>
                  <td className="px-5 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal">Commission History (Last 6 Months)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Platform Fees</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">My Commission</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.month} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-charcoal">{row.month}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(row.platformFees)}</td>
                  <td className="px-5 py-3 text-right font-medium text-navy">{formatCurrency(row.commission)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${row.status === "Paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Commissions are earned on partner platform fees only and processed on the 1st of each month.
      </p>
    </div>
  );
}

// ─── ROUTER ────────────────────────────────────────────────────────────────────
export default function SalesCommissionPage() {
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    getMyProfile().then(({ data }) => {
      setUserType(data?.profile?.user_type ?? "sales_rep");
    });
  }, []);

  if (userType === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (userType === "admin") return <AdminCommissionView />;
  return <RepCommissionView />;
}
