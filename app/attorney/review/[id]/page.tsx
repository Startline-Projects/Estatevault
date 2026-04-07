"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DOC_LABELS: Record<string, string> = {
  will: "Last Will & Testament",
  trust: "Revocable Living Trust",
  pour_over_will: "Pour-Over Will",
  poa: "Durable Power of Attorney",
  healthcare_directive: "Healthcare Directive",
};

interface ReviewRecord {
  id: string;
  order_id: string;
  status: string;
  sla_deadline: string;
  created_at: string;
  orders: {
    product_type: string;
    client_id: string;
    amount_total: number;
    clients: {
      profiles: { full_name: string | null; email: string } | null;
    } | null;
  } | null;
}

export default function AttorneyReviewPage() {
  const params = useParams();
  const reviewId = params.id as string;
  const router = useRouter();

  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [docs, setDocs] = useState<Array<{ id: string; document_type: string; storage_path: string | null }>>([]);
  const [decision, setDecision] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: r } = await supabase
        .from("attorney_reviews")
        .select("id, order_id, status, sla_deadline, created_at, orders(product_type, client_id, amount_total, clients(profiles(full_name, email)))")
        .eq("id", reviewId)
        .single();

      if (r) {
        setReview(r as unknown as ReviewRecord);
        const { data: d } = await supabase
          .from("documents")
          .select("id, document_type, storage_path")
          .eq("order_id", (r as Record<string, unknown>).order_id as string);
        setDocs(d || []);
      }
    }
    load();
  }, [reviewId]);

  async function handleDownload(doc: { id: string; document_type: string; storage_path: string | null }) {
    if (!doc.storage_path) return;
    setDownloadingId(doc.id);
    try {
      const res = await fetch(`/api/documents/download?id=${doc.id}`);
      if (!res.ok) {
        alert("Unable to download document. Please try again.");
        return;
      }
      const { url } = await res.json();
      if (url) window.open(url, "_blank");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleSubmit() {
    if (!decision || !review) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Update review status
      await supabase
        .from("attorney_reviews")
        .update({ status: decision, notes, reviewed_at: new Date().toISOString() })
        .eq("id", reviewId);

      if (decision === "approved" || decision === "approved_with_notes") {
        await supabase.from("orders").update({ status: "delivered" }).eq("id", review.order_id);
        await supabase.from("documents").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("order_id", review.order_id);

        // Notify client by email
        await fetch("/api/attorney/notify-client", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewId }),
        });
      }

      await supabase.from("audit_log").insert({
        actor_id: user?.id,
        action: `attorney_review.${decision}`,
        resource_type: "attorney_review",
        resource_id: reviewId,
        metadata: { notes },
      });

      setSubmitted(true);
      setTimeout(() => router.push("/attorney"), 2000);
    } catch {
      alert("Failed to submit review. Please try again.");
      setSubmitting(false);
    }
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="mt-3 text-sm text-charcoal/50">Loading review...</p>
        </div>
      </div>
    );
  }

  const clientProfile = review.orders?.clients?.profiles;
  const clientName = clientProfile?.full_name || clientProfile?.email || "Client";
  const clientEmail = clientProfile?.email || "";
  const productType = review.orders?.product_type || "will";
  const packageName = productType === "trust" ? "Trust Package" : "Will Package";

  const slaDeadline = new Date(review.sla_deadline);
  const now = new Date();
  const hoursLeft = (slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  const slaOverdue = hoursLeft < 0;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-navy">Review submitted</h2>
          <p className="mt-2 text-sm text-charcoal/60">
            {decision === "approved" || decision === "approved_with_notes"
              ? "The client has been notified and their documents are now available."
              : "The file has been flagged. Returning to queue..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/attorney" className="inline-flex items-center gap-2 text-sm text-charcoal/60 hover:text-navy transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Queue
          </Link>
          <span className="text-base font-bold text-navy">EstateVault</span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Client info header */}
        <div className="rounded-xl bg-white border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl font-bold text-navy">{packageName} Review</h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-charcoal/60">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  {clientName}
                </span>
                {clientEmail && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    {clientEmail}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                  </svg>
                  Submitted {new Date(review.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
            <div className={`rounded-lg px-4 py-3 text-right ${slaOverdue ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${slaOverdue ? "text-red-600" : "text-amber-700"}`}>SLA Deadline</p>
              <p className={`text-sm font-bold mt-0.5 ${slaOverdue ? "text-red-700" : "text-amber-800"}`}>
                {slaDeadline.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
              {slaOverdue ? (
                <p className="text-xs text-red-500 mt-0.5">Overdue by {Math.abs(Math.round(hoursLeft))}h</p>
              ) : (
                <p className="text-xs text-amber-600 mt-0.5">{Math.floor(hoursLeft / 24)}d {Math.round(hoursLeft % 24)}h remaining</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Documents panel */}
          <div className="lg:col-span-3">
            <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-navy">Documents to Review</h2>
                <p className="text-xs text-charcoal/50 mt-0.5">Download and review each document before submitting your decision</p>
              </div>
              <div className="divide-y divide-gray-50">
                {docs.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-charcoal/50">No documents found for this order.</div>
                ) : (
                  docs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-navy/5 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-navy/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-navy">
                          {DOC_LABELS[d.document_type] || d.document_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </div>
                      {d.storage_path ? (
                        <button
                          onClick={() => handleDownload(d)}
                          disabled={downloadingId === d.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy/90 transition-colors disabled:opacity-60"
                        >
                          {downloadingId === d.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              Opening...
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                              Download PDF
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-charcoal/40 italic">Not yet generated</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Decision panel */}
          <div className="lg:col-span-2">
            <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-navy">Your Decision</h2>
                <p className="text-xs text-charcoal/50 mt-0.5">Review all documents before selecting</p>
              </div>
              <div className="p-6 space-y-3">
                {[
                  {
                    value: "approved",
                    label: "Approve",
                    desc: "Documents are complete and ready for delivery",
                    color: "border-green-400 bg-green-50",
                    dot: "bg-green-500",
                  },
                  {
                    value: "approved_with_notes",
                    label: "Approve with Notes",
                    desc: "Acceptable with comments for the client",
                    color: "border-yellow-400 bg-yellow-50",
                    dot: "bg-yellow-500",
                  },
                  {
                    value: "flagged",
                    label: "Flag for Consultation",
                    desc: "Hold delivery — client needs direct attorney consultation",
                    color: "border-red-400 bg-red-50",
                    dot: "bg-red-500",
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      decision === opt.value ? opt.color : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value={opt.value}
                      checked={decision === opt.value}
                      onChange={() => setDecision(opt.value)}
                      className="sr-only"
                    />
                    <div className={`mt-1 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${decision === opt.value ? `border-current` : "border-gray-300"}`}>
                      {decision === opt.value && <div className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy">{opt.label}</p>
                      <p className="text-xs text-charcoal/50 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="px-6 pb-6">
                <label className="block text-xs font-semibold text-navy mb-2">
                  Notes <span className="font-normal text-charcoal/40">(optional — visible to partner and client)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-charcoal placeholder:text-charcoal/30 focus:border-gold focus:outline-none resize-none transition-colors"
                  placeholder="Add any notes for the client or partner..."
                />

                <button
                  onClick={handleSubmit}
                  disabled={!decision || submitting}
                  className="mt-4 w-full min-h-[44px] rounded-xl bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Submit Review"
                  )}
                </button>

                {!decision && (
                  <p className="mt-2 text-center text-xs text-charcoal/40">Select a decision above to continue</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
