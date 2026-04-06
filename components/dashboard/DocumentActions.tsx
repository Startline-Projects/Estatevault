"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface DocumentRecord {
  id: string;
  document_type: string;
  status: string;
  storage_path: string | null;
}

interface DocumentActionsProps {
  orderId: string;
  productType: string;
  orderStatus: string;
}


export default function DocumentActions({ orderId, productType, orderStatus }: DocumentActionsProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [docsReady, setDocsReady] = useState(false);
  const [polling, setPolling] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [sentToEmail, setSentToEmail] = useState("");

  const isGenerating = orderStatus === "generating" || orderStatus === "paid";
  const packageName = productType === "trust" ? "Trust" : "Will";

  const fetchDocs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("documents")
      .select("id, document_type, status, storage_path")
      .eq("order_id", orderId);

    if (data && data.length > 0) {
      setDocuments(data as DocumentRecord[]);
      const ready = data.every((d) => d.status === "generated" || d.status === "delivered");
      if (ready) {
        setDocsReady(true);
        setPolling(false);
        return true;
      }
    }
    return false;
  }, [orderId]);

  useEffect(() => {
    fetchDocs().then((ready) => {
      if (!ready && isGenerating) {
        setPolling(true);
      }
    });
  }, [fetchDocs, isGenerating]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const ready = await fetchDocs();
      if (ready) clearInterval(interval);
    }, 3000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
    }, 120000); // Stop after 2 minutes
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [polling, fetchDocs]);

  async function handleSendEmail() {
    setEmailSending(true);
    setEmailError("");
    try {
      const res = await fetch("/api/documents/send-email", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setEmailError(data.error || "Failed to send"); setEmailSending(false); return; }
      setEmailSent(true);
      setSentToEmail(data.email || "");
    } catch {
      setEmailError("Failed to send email");
    }
    setEmailSending(false);
  }

  return (
    <div className="space-y-4">
      {/* Document generation status */}
      {isGenerating && !docsReady && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">
                Your {packageName} Package is being prepared
              </p>
              <p className="text-xs text-blue-600 mt-0.5">Usually ready within 2 minutes</p>
            </div>
          </div>
        </div>
      )}

      {/* Download buttons */}
      {docsReady && documents.filter((d) => d.storage_path).length > 0 && (
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-navy mb-3">Your Documents Are Ready</h3>
          <a
            href="/dashboard/documents"
            className="w-full flex items-center justify-between rounded-lg bg-navy px-4 py-3 text-sm transition-colors hover:bg-navy/90"
          >
            <span className="text-white font-medium">Download Your {packageName} Package</span>
            <span className="text-gold font-semibold text-xs">View &amp; Download &rarr;</span>
          </a>
        </div>
      )}

      {/* Send to email button */}
      {docsReady && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSendEmail}
            disabled={emailSending}
            className="text-sm font-medium text-navy/60 hover:text-navy transition-colors disabled:opacity-50"
          >
            {emailSending ? "Sending..." : emailSent ? "Resend documents to my email" : "Send documents to my email"}
          </button>
          {emailSent && sentToEmail && (
            <span className="text-xs text-green-600">&#10003; Sent to {sentToEmail}</span>
          )}
          {emailError && <span className="text-xs text-red-600">{emailError}</span>}
        </div>
      )}
    </div>
  );
}
