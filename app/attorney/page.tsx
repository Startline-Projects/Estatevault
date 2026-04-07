"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Review {
  id: string;
  order_id: string;
  status: string;
  sla_deadline: string;
  created_at: string;
  reviewer_type: string | null;
  fee_destination: string | null;
  fee_amount: number | null;
  partner_id: string | null;
  orders: {
    product_type: string;
    client_id: string;
    clients: { profiles: { full_name: string | null; email: string } | null } | null;
  } | null;
  partners: { company_name: string } | null;
}

function SLABadge({ deadline }: { deadline: string }) {
  const d = new Date(deadline);
  const now = new Date();
  const hoursLeft = (d.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Overdue {Math.abs(Math.round(hoursLeft))}h
      </span>
    );
  }
  if (hoursLeft < 12) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
        {Math.round(hoursLeft)}h left
      </span>
    );
  }
  const daysLeft = Math.floor(hoursLeft / 24);
  const remainingHours = Math.round(hoursLeft % 24);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
      {daysLeft > 0 ? `${daysLeft}d ${remainingHours}h` : `${Math.round(hoursLeft)}h`} left
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  approved_with_notes: "bg-yellow-100 text-yellow-700",
  flagged: "bg-red-100 text-red-700",
  in_review: "bg-blue-100 text-blue-700",
  pending: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  approved_with_notes: "Approved w/ Notes",
  flagged: "Flagged",
  in_review: "In Review",
  pending: "Pending",
};

export default function AttorneyQueuePage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
      setUserName(profile?.full_name || profile?.email || "Attorney");

      const { data } = await supabase
        .from("attorney_reviews")
        .select(`
          id, order_id, status, sla_deadline, created_at,
          reviewer_type, fee_destination, fee_amount, partner_id,
          orders(product_type, client_id, clients(profiles(full_name, email))),
          partners(company_name)
        `)
        .eq("attorney_id", user.id)
        .order("created_at", { ascending: false });

      setReviews((data || []) as unknown as Review[]);
      setLoading(false);
    }
    load();
  }, []);

  function getClientName(r: Review): string {
    const p = r.orders?.clients?.profiles;
    return p?.full_name || p?.email || "Client";
  }

  function getClientEmail(r: Review): string {
    return r.orders?.clients?.profiles?.email || "";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="mt-3 text-sm text-charcoal/50">Loading review queue...</p>
        </div>
      </div>
    );
  }

  const pending = reviews.filter((r) => r.status === "pending" || r.status === "in_review");
  const completed = reviews.filter((r) => ["approved", "approved_with_notes", "flagged"].includes(r.status));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center">
              <span className="text-sm font-bold text-white">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-navy">{userName}</p>
              <p className="text-xs text-charcoal/50">Review Attorney</p>
            </div>
          </div>
          <span className="text-lg font-bold text-navy tracking-tight">EstateVault</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl bg-white border border-gray-200 p-5">
            <p className="text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Pending Review</p>
            <p className="mt-2 text-3xl font-bold text-navy">{pending.length}</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-5">
            <p className="text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Completed</p>
            <p className="mt-2 text-3xl font-bold text-navy">{completed.length}</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-5">
            <p className="text-xs font-semibold text-charcoal/50 uppercase tracking-wider">SLA</p>
            <p className="mt-2 text-3xl font-bold text-navy">4 days</p>
          </div>
        </div>

        {/* Pending queue */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-navy mb-4">
            Pending Reviews
            {pending.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-gold/10 px-2.5 py-0.5 text-sm font-semibold text-gold">{pending.length}</span>
            )}
          </h2>

          {pending.length === 0 ? (
            <div className="rounded-xl bg-white border border-gray-200 p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-charcoal">All caught up</p>
              <p className="text-xs text-charcoal/50 mt-1">No pending reviews.</p>
            </div>
          ) : (
            <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Package</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Partner</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Submitted</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wider">SLA</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium text-navy">{getClientName(r)}</p>
                        <p className="text-xs text-charcoal/40 mt-0.5">{getClientEmail(r)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-full bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy">
                          {r.orders?.product_type === "trust" ? "Trust" : "Will"} Package
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-charcoal/60">{r.partners?.company_name || <span className="text-charcoal/30 italic">Direct</span>}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-charcoal/50">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                      </td>
                      <td className="px-5 py-4">
                        <SLABadge deadline={r.sla_deadline} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/attorney/review/${r.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-white hover:bg-gold/90 transition-colors"
                        >
                          Review
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Completed */}
        {completed.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-navy mb-4">Completed ({completed.length})</h2>
            <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Package</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Partner</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal/50 uppercase tracking-wider">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {completed.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-4">
                        <p className="font-medium text-navy">{getClientName(r)}</p>
                        <p className="text-xs text-charcoal/40 mt-0.5">{getClientEmail(r)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-full bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy">
                          {r.orders?.product_type === "trust" ? "Trust" : "Will"} Package
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-charcoal/60">{r.partners?.company_name || <span className="text-charcoal/30 italic">Direct</span>}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-charcoal/50">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
