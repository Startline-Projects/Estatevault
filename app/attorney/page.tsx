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

export default function AttorneyQueuePage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();
      setUserName(profile?.full_name || profile?.email || "Attorney");

      // Fetch reviews assigned to this attorney
      // Mo sees: direct clients, non-attorney partner clients, attorney partners without in-house
      // Partner in-house attorneys see: only reviews assigned to them
      // RLS ensures attorney_id = auth.uid()
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

  function getClientName(r: Review): string {
    const profile = r.orders?.clients?.profiles;
    return profile?.full_name || profile?.email || "Client";
  }

  function getPartnerName(r: Review): string | null {
    return r.partners?.company_name || null;
  }

  function formatSLA(deadline: string): { text: string; isOverdue: boolean; isUrgent: boolean } {
    const d = new Date(deadline);
    const now = new Date();
    const hoursLeft = (d.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft < 0) return { text: `Overdue by ${Math.abs(Math.round(hoursLeft))}h`, isOverdue: true, isUrgent: true };
    if (hoursLeft < 12) return { text: `${Math.round(hoursLeft)}h remaining`, isOverdue: false, isUrgent: true };
    return { text: `${Math.round(hoursLeft)}h remaining`, isOverdue: false, isUrgent: false };
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy">Attorney Review Queue</h1>
            <p className="mt-1 text-sm text-charcoal/60">Welcome, {userName}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-gold/10 px-4 py-1.5 text-sm font-semibold text-gold">
              {pending.length} pending
            </span>
          </div>
        </div>

        {/* Pending Reviews */}
        <h2 className="mt-8 text-lg font-bold text-navy">
          Pending Reviews ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="mt-4 rounded-xl bg-white border border-gray-200 p-10 text-center">
            <svg className="mx-auto h-12 w-12 text-charcoal/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-3 text-sm text-charcoal/50">No pending reviews. You&apos;re all caught up.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl bg-white border border-gray-200">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-charcoal/50">
              <div className="col-span-3">Client</div>
              <div className="col-span-2">Partner</div>
              <div className="col-span-2">Document</div>
              <div className="col-span-2">Submitted</div>
              <div className="col-span-2">SLA</div>
              <div className="col-span-1">Action</div>
            </div>

            {pending.map((r) => {
              const sla = formatSLA(r.sla_deadline);
              const clientName = getClientName(r);
              const partnerName = getPartnerName(r);

              return (
                <div key={r.id} className={`grid grid-cols-12 gap-4 items-center px-6 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors ${sla.isOverdue ? "bg-red-50/50" : ""}`}>
                  <div className="col-span-3">
                    <p className="text-sm font-medium text-navy truncate">{clientName}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-charcoal/60 truncate">
                      {partnerName || <span className="text-charcoal/30">Direct</span>}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="inline-flex items-center rounded-full bg-navy/5 px-2.5 py-0.5 text-xs font-medium text-navy">
                      {r.orders?.product_type === "trust" ? "Trust" : "Will"} Package
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-charcoal/50">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className={`text-xs font-medium ${sla.isOverdue ? "text-red-600" : sla.isUrgent ? "text-orange-600" : "text-charcoal/50"}`}>
                      {sla.text}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <Link
                      href={`/attorney/review/${r.id}`}
                      className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold/90 transition-colors"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed Reviews */}
        <h2 className="mt-10 text-lg font-bold text-navy">
          Completed ({completed.length})
        </h2>

        {completed.length === 0 ? (
          <p className="mt-4 text-sm text-charcoal/60">No completed reviews yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {completed.map((r) => (
              <div key={r.id} className="rounded-xl bg-white border border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-navy">
                      {getClientName(r)} — {r.orders?.product_type === "trust" ? "Trust" : "Will"}
                    </p>
                    <p className="text-xs text-charcoal/60 mt-0.5">
                      {getPartnerName(r) ? `via ${getPartnerName(r)}` : "Direct client"} &middot; {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  r.status === "flagged"
                    ? "bg-red-100 text-red-700"
                    : r.status === "approved_with_notes"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                }`}>
                  {r.status === "flagged" ? "Flagged" : r.status === "approved_with_notes" ? "Approved w/ Notes" : "Approved"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
