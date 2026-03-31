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
      "Store the original in a safe place — tell your executor where it is",
    ],
  },
  trust: {
    title: "Signing Your Trust",
    steps: [
      "You sign as both Grantor and Trustee",
      "Notarization is required in Michigan",
      "Keep the original — certified copies for your records",
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
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [docsReady, setDocsReady] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).single();
    if (!client) { setLoading(false); return false; }

    // Check for pending/processing orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id, product_type, status")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const latestOrder = orders?.[0] || null;
    const isPending = latestOrder && (latestOrder.status === "generating" || latestOrder.status === "paid");

    // Get documents
    const { data: docs } = await supabase
      .from("documents")
      .select("id, document_type, status, storage_path, generated_at, delivered_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: true });

    const docList = docs || [];
    setDocuments(docList);

    const allReady = docList.length > 0 && docList.every((d) => d.status === "generated" || d.status === "delivered");

    if (allReady) {
      setDocsReady(true);
      setPendingOrder(null);
      setLoading(false);
      return true;
    }

    if (isPending) {
      setPendingOrder(latestOrder);
    } else {
      setPendingOrder(null);
    }

    setLoading(false);
    return false;
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll when there's a pending order
  useEffect(() => {
    if (!pendingOrder || docsReady) return;

    const interval = setInterval(async () => {
      const ready = await fetchData();
      if (ready) clearInterval(interval);
    }, 3000);

    const timeout = setTimeout(() => clearInterval(interval), 300000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [pendingOrder, docsReady, fetchData]);

  function formatDocType(t: string) {
    return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  async function handleDownload(doc: Document) {
    if (!doc.storage_path) return;
    const supabase = createClient();
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  if (loading) {
    return <div className="max-w-4xl space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}</div>;
  }

  const readyDocs = documents.filter((d) => d.status === "generated" || d.status === "delivered");
  const packageName = pendingOrder?.product_type === "trust" ? "Trust" : "Will";

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-navy">My Documents</h1>
      <p className="mt-1 text-sm text-charcoal/60">Your estate planning documents and execution guides.</p>

      {/* Preparing status card — shown when order is processing */}
      {pendingOrder && !docsReady && (
        <div className="mt-6 rounded-xl bg-blue-50 border border-blue-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">
                Your {packageName} Package is being prepared
              </p>
              <p className="text-xs text-blue-600 mt-1">Usually ready within 2 minutes</p>
            </div>
          </div>
          {/* Show individual document progress */}
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

      {/* No documents and no pending order */}
      {documents.length === 0 && !pendingOrder && (
        <div className="mt-10 text-center">
          <span className="text-4xl">📄</span>
          <p className="mt-4 text-sm text-charcoal/50">No documents yet.</p>
          <Link href="/quiz" className="mt-4 inline-flex items-center rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">Take the Quiz</Link>
        </div>
      )}

      {/* Document cards — show when ready */}
      {readyDocs.length > 0 && (
        <>
          <div className="mt-6 space-y-3">
            {readyDocs.map((doc) => (
              <div key={doc.id} className="rounded-xl bg-white border border-gray-200 p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">{formatDocType(doc.document_type)}</p>
                  <p className="text-xs text-charcoal/50 mt-1">
                    {doc.delivered_at ? `Delivered ${new Date(doc.delivered_at).toLocaleDateString()}` : doc.generated_at ? `Generated ${new Date(doc.generated_at).toLocaleDateString()}` : "Ready"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-700">
                    Ready
                  </span>
                  {doc.storage_path ? (
                    <button
                      onClick={() => handleDownload(doc)}
                      className="rounded-lg bg-navy px-4 py-2 text-xs text-white font-semibold hover:bg-navy/90 transition-colors"
                    >
                      Download
                    </button>
                  ) : (
                    <button disabled className="rounded-lg bg-gray-100 px-4 py-2 text-xs text-gray-400 cursor-not-allowed">Download</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Execution guides */}
          <div className="mt-10">
            <h2 className="text-lg font-bold text-navy">Execution Guides</h2>
            <p className="mt-1 text-sm text-charcoal/60">How to properly sign and execute each document.</p>
            <div className="mt-4 space-y-2">
              {readyDocs.map((doc) => {
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

          {/* Amendment section */}
          <div className="mt-10 rounded-xl bg-gray-50 border border-gray-200 p-6">
            <h3 className="text-base font-bold text-navy">Need to make a change?</h3>
            <p className="mt-1 text-sm text-charcoal/60">Life happens. Update your documents for $50.</p>
            <Link href="/dashboard/amendment" className="mt-4 inline-flex items-center rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 transition-colors">
              Request an Amendment
            </Link>
            <p className="mt-2 text-xs text-charcoal/40">Common updates: new beneficiary, new executor, address change, new assets</p>
          </div>
        </>
      )}
    </div>
  );
}
