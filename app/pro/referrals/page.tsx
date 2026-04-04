"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface ReferralRow {
  id: string;
  client_name: string;
  reason: string;
  status: string;
  created_at: string;
  referral_fee: number;
  referral_fee_paid: boolean;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-yellow-100 text-yellow-700" },
    contacted: { label: "Contacted", cls: "bg-blue-100 text-blue-700" },
    converted: { label: "Converted", cls: "bg-green-100 text-green-700" },
    closed: { label: "Closed", cls: "bg-gray-100 text-gray-600" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function ProReferralsPage() {
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
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

      const { data: refs } = await supabase
        .from("referrals")
        .select("id, client_name, reason, status, created_at, referral_fee, referral_fee_paid")
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false });

      setReferrals(
        (refs || []).map((r) => ({
          id: r.id,
          client_name: r.client_name || "Unknown",
          reason: r.reason || "Attorney referral",
          status: r.status || "pending",
          created_at: r.created_at,
          referral_fee: r.referral_fee || 7500,
          referral_fee_paid: r.referral_fee_paid || false,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  const totalReferrals = referrals.length;
  const converted = referrals.filter((r) => r.status === "converted").length;
  const feesEarned = referrals
    .filter((r) => r.referral_fee_paid)
    .reduce((sum, r) => sum + r.referral_fee, 0);

  if (loading) {
    return (
      <div className="max-w-5xl space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-navy">Referrals</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Clients routed to attorneys earn you a $75 referral fee when the case converts.
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <p className="text-xs text-charcoal/50 uppercase tracking-wider">
            Total Referrals
          </p>
          <p className="mt-2 text-2xl font-bold text-navy">{totalReferrals}</p>
        </div>
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <p className="text-xs text-charcoal/50 uppercase tracking-wider">
            Converted
          </p>
          <p className="mt-2 text-2xl font-bold text-navy">{converted}</p>
        </div>
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <p className="text-xs text-charcoal/50 uppercase tracking-wider">
            Fees Earned
          </p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            ${(feesEarned / 100).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Referrals table or empty state */}
      {referrals.length === 0 ? (
        <div className="mt-16 text-center">
          <span className="text-4xl">🔗</span>
          <p className="mt-4 text-sm text-charcoal/50">No referrals yet</p>
          <p className="text-xs text-charcoal/60 mt-1 max-w-md mx-auto">
            When a client triggers a hard stop (e.g., special needs dependent or irrevocable trust),
            they are automatically routed to an attorney. You earn a $75 referral fee for each
            case that converts.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl bg-white border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">
                  Client
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">
                  Reason
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">
                  Fee
                </th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-navy">
                    {r.client_name}
                  </td>
                  <td className="px-4 py-3 text-charcoal/70">{r.reason}</td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3 text-charcoal/50 text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.referral_fee_paid ? (
                      <span className="font-semibold text-green-600">$75</span>
                    ) : (
                      <span className="text-charcoal/60 text-xs">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
