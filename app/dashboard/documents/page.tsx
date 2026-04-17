"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const EXECUTION_GUIDES: Record<string, { title: string; steps: string[] }> = {
  will: {
    title: "Signing Your Will",
    steps: [
      "You must sign in front of 2 witnesses",
      "Witnesses must be 18+ and not named in your will",
      "A notary is not required but recommended",
      "Sign every page if your will is multiple pages",
      "Store the original in a safe place, tell your executor where it is",
    ],
  },
  trust: {
    title: "Signing Your Trust",
    steps: [
      "You sign as both Grantor and Trustee",
      "Notarization is required in Michigan",
      "Keep the original, certified copies for your records",
      "Your trust is not complete until assets are transferred",
    ],
  },
  pour_over_will: {
    title: "Signing Your Pour-Over Will",
    steps: [
      "Same execution requirements as a standard will",
      "2 witnesses required. Notarization recommended.",
    ],
  },
  poa: {
    title: "Signing Your Power of Attorney",
    steps: [
      "Must be notarized in Michigan",
      "Your agent does not sign at execution",
      "Give a copy to your agent and your financial institutions",
    ],
  },
  healthcare_directive: {
    title: "Signing Your Healthcare Directive",
    steps: [
      "Requires 2 witnesses in Michigan",
      "Witnesses cannot be your patient advocate",
      "Witnesses cannot be your healthcare providers",
      "Give a copy to your patient advocate and your doctor",
    ],
  },
};

const DOC_LABELS: Record<string, string> = {
  will: "Last Will & Testament",
  trust: "Revocable Living Trust",
  pour_over_will: "Pour-Over Will",
  poa: "Durable Power of Attorney",
  healthcare_directive: "Healthcare Directive",
};

interface Document {
  id: string;
  document_type: string;
  status: string;
  storage_path: string | null;
  generated_at: string | null;
  delivered_at: string | null;
}

interface Order {
  id: string;
  product_type: string;
  status: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [docsReady, setDocsReady] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [markingExecuted, setMarkingExecuted] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "idle";

    const { data: client } = await supabase.from("clients").select("id, documents_executed").eq("profile_id", user.id).single();
    if (!client) { setLoading(false); return "idle"; }
    if (client.documents_executed) setExecuted(true);

    const { data: orders } = await supabase
      .from("orders")
      .select("id, product_type, status")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const order = orders?.[0] || null;
    setLatestOrder(order);

    const { data: docs } = await supabase
      .from("documents")
      .select("id, document_type, status, storage_path, generated_at, delivered_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: true });

    const docList = docs || [];
    setDocuments(docList);
    setLoading(false);

    // "ready" means all docs generated/delivered AND not under review
    const allGenerated = docList.length > 0 && docList.every((d) => d.status === "generated" || d.status === "delivered");
    const isUnderReview = order?.status === "review";

    if (allGenerated && !isUnderReview) {
      setDocsReady(true);
      return "ready";
    }

    if (order?.status === "generating" || order?.status === "paid") return "generating";
    if (isUnderReview) return "review";
    return "idle";
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll when generating
  useEffect(() => {
    if (docsReady) return;
    if (latestOrder?.status !== "generating" && latestOrder?.status !== "paid") return;

    const interval = setInterval(async () => {
      const state = await fetchData();
      if (state === "ready") clearInterval(interval);
    }, 3000);

    const timeout = setTimeout(() => clearInterval(interval), 300000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [latestOrder?.status, docsReady, fetchData]);

  function formatDocType(t: string) {
    return DOC_LABELS[t] || t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  async function handleDownload(doc: Document) {
    if (!doc.storage_path) return;
    setDownloadingId(doc.id);
    try {
      const res = await fetch(`/api/documents/download?id=${doc.id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Unable to download document.");
        return;
      }
      const { url } = await res.json();
      if (!url) return;

      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${doc.document_type.replace(/_/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return <div className="max-w-4xl space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}</div>;
  }

  const isGenerating = (latestOrder?.status === "generating" || latestOrder?.status === "paid") && !docsReady;
  const isUnderReview = latestOrder?.status === "review";
  const packageName = latestOrder?.product_type === "trust" ? "Trust" : "Will";
  const deliveredDocs = documents.filter((d) => d.status === "delivered");
  const visibleDocs = isUnderReview ? documents : documents.filter((d) => d.status === "generated" || d.status === "delivered");

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-navy">My Documents</h1>
      <p className="mt-1 text-sm text-charcoal/60">Your estate planning documents and execution guides.</p>

      {/* Generating state */}
      {isGenerating && (
        <div className="mt-6 rounded-xl bg-blue-50 border border-blue-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Your {packageName} Package is being prepared</p>
              <p className="text-xs text-blue-600 mt-1">Usually ready within 2 minutes</p>
            </div>
          </div>
          {documents.length > 0 && (
            <div className="mt-4 space-y-2 ml-9">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 text-sm">
                  {doc.status === "generated" || doc.status === "delivered" ? (
                    <span className="text-green-600">&#10003;</span>
                  ) : (
                    <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  <span className={doc.status === "generated" || doc.status === "delivered" ? "text-charcoal" : "text-charcoal/50"}>
                    {formatDocType(doc.document_type)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Under attorney review banner */}
      {isUnderReview && (
        <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-6">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">Your documents are under attorney review</p>
              <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                A licensed Michigan attorney is reviewing your {packageName} Package. Your documents will be unlocked and ready to download once the review is complete, this typically takes 1 to 4 business days.
              </p>
              <p className="text-xs text-amber-600 mt-2">You will receive an email as soon as your documents are approved.</p>
            </div>
          </div>
        </div>
      )}

      {/* No documents and not generating */}
      {documents.length === 0 && !isGenerating && (
        <div className="mt-10 text-center">
          <span className="text-4xl">📄</span>
          <p className="mt-4 text-sm text-charcoal/50">No documents yet.</p>
          <Link href="/quiz" className="mt-4 inline-flex items-center rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">Take the Quiz</Link>
        </div>
      )}

      {/* Document cards */}
      {visibleDocs.length > 0 && (
        <div className="mt-6 space-y-3">
          {visibleDocs.map((doc) => {
            const isDelivered = doc.status === "delivered" || doc.status === "generated";
            const canDownload = isDelivered && !!doc.storage_path && !isUnderReview;
            const isDownloading = downloadingId === doc.id;

            return (
              <div key={doc.id} className="rounded-xl bg-white border border-gray-200 p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">{formatDocType(doc.document_type)}</p>
                  <p className="text-xs text-charcoal/50 mt-1">
                    {isUnderReview
                      ? "Locked until attorney review is complete"
                      : doc.delivered_at
                      ? `Delivered ${new Date(doc.delivered_at).toLocaleDateString()}`
                      : doc.generated_at
                      ? `Generated ${new Date(doc.generated_at).toLocaleDateString()}`
                      : "Ready"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isUnderReview ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-amber-100 text-amber-700">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-9V4m0 0L9 7m3-3l3 3" />
                      </svg>
                      Under Review
                    </span>
                  ) : (
                    <span className="rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-700">Ready</span>
                  )}
                  {canDownload ? (
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={isDownloading}
                      className="rounded-lg bg-navy px-4 py-2 text-xs text-white font-semibold hover:bg-navy/90 transition-colors disabled:opacity-60"
                    >
                      {isDownloading ? "..." : "Download"}
                    </button>
                  ) : (
                    <button disabled className="rounded-lg bg-gray-100 px-4 py-2 text-xs text-gray-400 cursor-not-allowed flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      Locked
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Execution guides, only show when docs are ready (not under review) */}
      {docsReady && deliveredDocs.length > 0 && (
        <>
          <div className="mt-10">
            <h2 className="text-lg font-bold text-navy">Execution Guides</h2>
            <p className="mt-1 text-sm text-charcoal/60">How to properly sign and execute each document.</p>
            <div className="mt-4 space-y-2">
              {deliveredDocs.map((doc) => {
                const guide = EXECUTION_GUIDES[doc.document_type];
                if (!guide) return null;
                const isOpen = openGuide === doc.document_type;
                return (
                  <div key={doc.document_type} className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                    <button onClick={() => setOpenGuide(isOpen ? null : doc.document_type)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                      <span className="text-sm font-medium text-navy">{guide.title}</span>
                      <span className="text-gold">{isOpen ? "\u2212" : "+"}</span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4">
                        <ul className="space-y-2">
                          {guide.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-charcoal/70">
                              <span className="mt-1 text-xs text-gold">&bull;</span>{step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mark as executed */}
          <div className="mt-10 rounded-xl bg-navy/5 border border-navy/10 p-6">
            {executed ? (
              <div className="flex items-center gap-3">
                <span className="text-green-600 text-xl">✅</span>
                <div>
                  <p className="text-sm font-semibold text-navy">Documents marked as signed</p>
                  <p className="text-xs text-charcoal/50 mt-0.5">Your plan completion has been updated.</p>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-navy">Have you signed your documents?</h3>
                <p className="mt-1 text-sm text-charcoal/60">Once you have physically signed and witnessed all your documents, mark them as complete.</p>
                <button
                  onClick={async () => {
                    setMarkingExecuted(true);
                    const res = await fetch("/api/client/mark-executed", { method: "POST" });
                    if (res.ok) setExecuted(true);
                    setMarkingExecuted(false);
                  }}
                  disabled={markingExecuted}
                  className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50 transition-colors"
                >
                  {markingExecuted ? "Saving..." : "I have signed my documents"}
                </button>
              </>
            )}
          </div>

          {/* Amendment section */}
          <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-6">
            <h3 className="text-base font-bold text-navy">Need to make a change?</h3>
            <p className="mt-1 text-sm text-charcoal/60">Life happens. Update your documents for $50.</p>
            <Link href="/dashboard/amendment" className="mt-4 inline-flex items-center rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 transition-colors">
              Request an Amendment
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
