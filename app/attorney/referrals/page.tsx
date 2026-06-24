"use client";

import { useEffect, useState } from "react";
import {
  getAttorneyReferrals,
  setReferralOutcome,
  type AttorneyReferralRow,
} from "@/lib/api-client/attorney";

// status → attorney-facing label. The attorney's outcome maps onto the existing
// status values: converted → "Converted", closed → "Not converted". Anything
// the attorney hasn't judged yet (pending/contacted) reads as a new lead.
const STATUS_LABELS: Record<string, string> = {
  pending: "New",
  contacted: "New",
  converted: "Converted",
  closed: "Not converted",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  contacted: "bg-amber-50 text-amber-700",
  converted: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AttorneyReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [referrals, setReferrals] = useState<AttorneyReferralRow[]>([]);
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const { data, error } = await getAttorneyReferrals();
      if (error) setLoadError(error);
      else if (data?.referrals) setReferrals(data.referrals);
      setLoading(false);
    }
    load();
  }, []);

  async function record(id: string, outcome: "converted" | "not_converted") {
    setRowError((s) => ({ ...s, [id]: "" }));
    setRowSaving((s) => ({ ...s, [id]: true }));
    const { error } = await setReferralOutcome(id, outcome);
    setRowSaving((s) => ({ ...s, [id]: false }));
    if (error) {
      setRowError((s) => ({ ...s, [id]: error || "Failed. Try again." }));
      return;
    }
    const status = outcome === "converted" ? "converted" : "closed";
    setReferrals((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  const newLeads = referrals.filter((r) => {
    const s = r.status ?? "pending";
    return s === "pending" || s === "contacted";
  }).length;
  const convertedCount = referrals.filter((r) => r.status === "converted").length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Attorney Referrals</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Clients routed to you after a hard stop during intake — they need a licensed attorney.
          Reach out, then mark each lead converted or not. The admin sees your outcome and releases
          the partner&apos;s referral fee.
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Leads</p>
          <p className="mt-1 text-2xl font-bold text-navy">{referrals.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">New</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{newLeads}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Converted</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{convertedCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {referrals.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">No referrals yet.</div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Received</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Outcome</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => {
                  const status = r.status ?? "pending";
                  const isPaid = !!r.referral_fee_paid;
                  const isConverted = status === "converted";
                  const isNotConverted = status === "closed";
                  return (
                    <tr key={r.id} className="border-b border-gray-50">
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
                              <a href={`tel:${r.client_phone}`} className="block text-xs text-navy/60 hover:underline">
                                {r.client_phone}
                              </a>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-charcoal/40">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-charcoal/70">{r.reason}</td>
                      <td className="px-6 py-3 text-charcoal/70">
                        {r.partners?.company_name ?? "EstateVault"}
                      </td>
                      <td className="px-6 py-3 text-charcoal/60">{formatDate(r.created_at)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-500"}`}>
                          {STATUS_LABELS[status] ?? status}
                        </span>
                        {isPaid && <span className="ml-1 text-xs text-green-600">paid</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {isPaid ? (
                          <span className="text-xs text-gray-400">Settled</span>
                        ) : (
                          <>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => record(r.id, "converted")}
                                disabled={rowSaving[r.id] || isConverted}
                                className="whitespace-nowrap rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-gold/90 disabled:opacity-50"
                              >
                                {rowSaving[r.id] ? "Saving…" : "Converted"}
                              </button>
                              <button
                                onClick={() => record(r.id, "not_converted")}
                                disabled={rowSaving[r.id] || isNotConverted}
                                className="whitespace-nowrap rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-charcoal/60 hover:bg-gray-50 disabled:opacity-50"
                              >
                                Not converted
                              </button>
                            </div>
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
