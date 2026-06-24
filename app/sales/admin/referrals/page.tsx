"use client";

import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/api-client/profile";
import {
  getAdminReferrals,
  convertReferral,
  type AdminReferralRow,
} from "@/lib/api-client/sales";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  contacted: "bg-blue-50 text-blue-700",
  converted: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

function dollars(cents: number | null): string {
  return `$${Math.round((cents ?? 0) / 100)}`;
}

export default function AdminReferralsPage() {
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [referrals, setReferrals] = useState<AdminReferralRow[]>([]);
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const { data: prof } = await getMyProfile();
      if (prof?.profile?.user_type !== "admin") {
        setAuthState("denied");
        return;
      }
      setAuthState("ok");
      const { data } = await getAdminReferrals();
      if (data?.referrals) setReferrals(data.referrals);
    }
    load();
  }, []);

  async function convert(id: string) {
    setRowError((s) => ({ ...s, [id]: "" }));
    setRowSaving((s) => ({ ...s, [id]: true }));
    const { error } = await convertReferral(id);
    setRowSaving((s) => ({ ...s, [id]: false }));
    if (error) {
      setRowError((s) => ({ ...s, [id]: "Failed. Try again." }));
      return;
    }
    setReferrals((rows) =>
      rows.map((r) =>
        r.id === id ? { ...r, status: "converted", referral_fee_paid: true } : r,
      ),
    );
  }

  if (authState === "loading") {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (authState === "denied") {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-sm text-gray-500">Admin access only.</p>
      </div>
    );
  }

  const total = referrals.length;
  const converted = referrals.filter((r) => r.status === "converted").length;
  const feesPaid = referrals
    .filter((r) => r.referral_fee_paid)
    .reduce((sum, r) => sum + (r.referral_fee ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Attorney Referrals</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Hard-stop clients routed to attorneys. Mark a case converted to credit the partner&apos;s
          referral fee.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Referrals</p>
          <p className="mt-1 text-2xl font-bold text-navy">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Converted</p>
          <p className="mt-1 text-2xl font-bold text-navy">{converted}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fees Paid</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{dollars(feesPaid)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {referrals.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">No referrals yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Partner</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => {
                  const isConverted = r.status === "converted";
                  return (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="px-6 py-3 font-medium text-charcoal">
                        {r.partners?.company_name ?? "EstateVault"}
                      </td>
                      <td className="px-6 py-3">
                        {r.client_name || r.client_email || r.client_phone ? (
                          <>
                            <p className="font-medium text-charcoal">{r.client_name || "—"}</p>
                            {r.client_email && (
                              <a href={`mailto:${r.client_email}`} className="block text-xs text-navy/60 hover:underline">
                                {r.client_email}
                              </a>
                            )}
                            {r.client_phone && (
                              <span className="block text-xs text-charcoal/50">{r.client_phone}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-charcoal/40">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-charcoal/70">{r.reason}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status ?? "pending"] ?? "bg-gray-100 text-gray-500"}`}>
                          {r.status ?? "pending"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-charcoal/70">
                        {dollars(r.referral_fee)}
                        {r.referral_fee_paid && <span className="ml-1 text-xs text-green-600">paid</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {isConverted ? (
                          <span className="text-xs text-gray-400">Converted</span>
                        ) : (
                          <>
                            <button
                              onClick={() => convert(r.id)}
                              disabled={rowSaving[r.id]}
                              className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold/90 disabled:opacity-50"
                            >
                              {rowSaving[r.id] ? "Saving…" : `Mark converted & pay ${dollars(r.referral_fee)}`}
                            </button>
                            {rowError[r.id] && <p className="mt-1 text-xs text-red-600">{rowError[r.id]}</p>}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
