"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AttorneyReviewPage() {
  const params = useParams();
  const reviewId = params.id as string;
  const router = useRouter();
  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  const [docs, setDocs] = useState<Array<{ id: string; document_type: string; storage_path: string }>>([]);
  const [decision, setDecision] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: r } = await supabase.from("attorney_reviews").select("*, orders(product_type, client_id, amount_total)").eq("id", reviewId).single();
      if (r) {
        setReview(r);
        const { data: d } = await supabase.from("documents").select("id, document_type, storage_path").eq("order_id", r.order_id);
        setDocs(d || []);
      }
    }
    load();
  }, [reviewId]);

  async function handleSubmit() {
    if (!decision) return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("attorney_reviews").update({ status: decision, notes, reviewed_at: new Date().toISOString() }).eq("id", reviewId);

    if (decision === "approved" || decision === "approved_with_notes") {
      const orderId = review?.order_id as string;
      await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId);
      await supabase.from("documents").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("order_id", orderId);
    }

    await supabase.from("audit_log").insert({ actor_id: user?.id, action: `attorney_review.${decision}`, resource_type: "attorney_review", resource_id: reviewId, metadata: { notes } });

    router.push("/attorney");
  }

  if (!review) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <a href="/attorney" className="text-sm text-navy/60 hover:text-navy">← Back to Queue</a>
        <h1 className="mt-4 text-2xl font-bold text-navy">Document Review</h1>
        <p className="mt-1 text-sm text-charcoal/60">Review the generated documents and submit your decision.</p>

        <div className="mt-6 rounded-xl bg-white border border-gray-200 p-6">
          <h2 className="text-base font-bold text-navy">Documents</h2>
          <div className="mt-4 space-y-3">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-navy">{d.document_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                {d.storage_path ? (
                  <button onClick={async () => { const res = await fetch(`/api/documents/download?id=${d.id}`); const data = await res.json(); if (data.url) window.open(data.url, "_blank"); }} className="text-sm text-gold hover:text-gold/80 font-medium">Download</button>
                ) : <span className="text-xs text-charcoal/40">Pending</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-white border border-gray-200 p-6">
          <h2 className="text-base font-bold text-navy">Your Decision</h2>
          <div className="mt-4 space-y-3">
            {[
              { value: "approved", label: "Approve", desc: "Documents are correct and ready for delivery" },
              { value: "approved_with_notes", label: "Approve with Notes", desc: "Documents are acceptable with notes for the client" },
              { value: "flagged", label: "Flag for Consultation", desc: "Hold delivery — client needs attorney consultation" },
            ].map((opt) => (
              <label key={opt.value} className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${decision === opt.value ? "border-gold bg-gold/5" : "border-gray-200 hover:border-gold/40"}`}>
                <input type="radio" name="decision" value={opt.value} checked={decision === opt.value} onChange={() => setDecision(opt.value)} className="mt-1 accent-gold" />
                <div><p className="text-sm font-semibold text-navy">{opt.label}</p><p className="text-xs text-charcoal/50">{opt.desc}</p></div>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-navy mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none resize-none" placeholder="Add notes visible to the partner and client..." />
          </div>

          <button onClick={handleSubmit} disabled={!decision || submitting} className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
