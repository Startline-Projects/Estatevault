"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Review { id: string; order_id: string; status: string; sla_deadline: string; created_at: string; orders: { product_type: string; client_id: string } | null }

export default function AttorneyQueuePage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("attorney_reviews").select("id, order_id, status, sla_deadline, created_at, orders(product_type, client_id)").eq("attorney_id", user.id).order("created_at", { ascending: false });
      setReviews((data || []) as unknown as Review[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-charcoal/50">Loading...</p></div>;

  const pending = reviews.filter((r) => r.status === "pending" || r.status === "in_review");
  const completed = reviews.filter((r) => r.status === "approved" || r.status === "approved_with_notes" || r.status === "flagged");

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-navy">Attorney Review Queue</h1>
        <p className="mt-1 text-sm text-charcoal/60">Documents awaiting your review.</p>

        <h2 className="mt-8 text-lg font-bold text-navy">Pending Reviews ({pending.length})</h2>
        {pending.length === 0 ? <p className="mt-4 text-sm text-charcoal/50">No pending reviews.</p> : (
          <div className="mt-4 space-y-3">
            {pending.map((r) => {
              const isOverdue = new Date(r.sla_deadline) < new Date();
              return (
                <div key={r.id} className={`rounded-xl bg-white border p-5 flex items-center justify-between ${isOverdue ? "border-red-300" : "border-gray-200"}`}>
                  <div>
                    <p className="text-sm font-semibold text-navy">{r.orders?.product_type === "trust" ? "Trust Package" : "Will Package"} Review</p>
                    <p className="text-xs text-charcoal/50 mt-1">SLA: {new Date(r.sla_deadline).toLocaleString()} {isOverdue && <span className="text-red-600 font-medium">OVERDUE</span>}</p>
                  </div>
                  <Link href={`/attorney/review/${r.id}`} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90">Review</Link>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="mt-8 text-lg font-bold text-navy">Completed ({completed.length})</h2>
        <div className="mt-4 space-y-3">
          {completed.map((r) => (
            <div key={r.id} className="rounded-xl bg-white border border-gray-200 p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">{r.orders?.product_type === "trust" ? "Trust" : "Will"} — {r.status.replace(/_/g, " ")}</p>
                <p className="text-xs text-charcoal/50">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${r.status === "flagged" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{r.status === "flagged" ? "Flagged" : "Approved"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
