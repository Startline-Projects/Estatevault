"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Doc = { type: string; status: string };

type Props = {
  orderId: string;
  packageName: string;
  initialOrderStatus: string;
  initialDocuments: Doc[];
};

function pretty(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PackageStatusCard({ orderId, packageName, initialOrderStatus, initialDocuments }: Props) {
  const router = useRouter();
  const [orderStatus, setOrderStatus] = useState(initialOrderStatus);
  const [documents, setDocuments] = useState<Doc[]>(initialDocuments);

  const allDocsReady = documents.length > 0 && documents.every((d) => d.status === "generated" || d.status === "delivered");
  const isReview = orderStatus === "review";
  const isDelivered = orderStatus === "delivered" || allDocsReady;
  const isPreparing = orderStatus === "generating" || orderStatus === "paid";
  const shouldPoll = !isDelivered && !isReview;

  const fetchStatus = useCallback(async () => {
    try {
      const supabase = createClient();
      const [docsRes, orderRes] = await Promise.all([
        supabase.from("documents").select("document_type, status").eq("order_id", orderId),
        supabase.from("orders").select("status").eq("id", orderId).single(),
      ]);
      console.log("[PackageStatusCard] poll", { orderId, docs: docsRes.data, docsErr: docsRes.error, order: orderRes.data, orderErr: orderRes.error });
      if (Array.isArray(docsRes.data)) {
        const mapped = docsRes.data.map((d) => ({ type: d.document_type as string, status: d.status as string }));
        setDocuments(mapped);
        const ready = mapped.length > 0 && mapped.every((d) => d.status === "generated" || d.status === "delivered");
        if (ready) router.refresh();
      }
      if (orderRes.data?.status) setOrderStatus(orderRes.data.status as string);
    } catch (e) {
      console.error("[PackageStatusCard] fetch error", e);
    }
  }, [orderId, router]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!shouldPoll) return;
    const id = setInterval(fetchStatus, 3000);
    const onFocus = () => fetchStatus();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [shouldPoll, fetchStatus]);

  useEffect(() => {
    if (!shouldPoll) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`docs-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `order_id=eq.${orderId}` }, () => {
        fetchStatus();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => {
        fetchStatus();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shouldPoll, orderId, fetchStatus]);

  return (
    <div className="mt-6 rounded-xl bg-white border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-navy">{packageName}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${isDelivered ? "bg-green-100 text-green-700" : isReview ? "bg-amber-100 text-amber-700" : isPreparing ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
          {isDelivered ? "Generated" : isReview ? "Under Review" : isPreparing ? "Preparing" : "Processing"}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {documents.map((doc, idx) => {
          const ready = doc.status === "generated" || doc.status === "delivered";
          const review = doc.status === "under_review";
          return (
            <div key={`${doc.type}-${idx}`} className="flex items-center justify-between text-sm">
              <span className="text-charcoal/80">{pretty(doc.type)}</span>
              <span className={`text-xs font-medium ${ready ? "text-green-600" : review ? "text-amber-600" : "text-blue-600"}`}>
                {ready ? "✅ Ready" : review ? "⏳ Under Review" : "⏳ Preparing"}
              </span>
            </div>
          );
        })}
      </div>
      <Link href="/dashboard/documents" className="mt-4 inline-block text-sm text-navy/60 hover:text-navy transition-colors">
        View all documents →
      </Link>
    </div>
  );
}
