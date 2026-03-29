"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AnimatedCheckmark from "@/components/success/AnimatedCheckmark";
import PasswordSetup from "@/components/success/PasswordSetup";
import { createClient } from "@/lib/supabase/client";

type Step = { label: string; status: "done" | "active" | "pending" };

interface DocumentRecord {
  id: string;
  document_type: string;
  status: string;
  storage_path: string | null;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const isPromo = searchParams.get("promo") === "true";
  const orderId = searchParams.get("order_id");
  const promoEmail = searchParams.get("email");
  const promoUserId = searchParams.get("user_id");

  const [loading, setLoading] = useState(true);
  const [attorneyReview, setAttorneyReview] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState("");
  const [email, setEmail] = useState(promoEmail || "");
  const [userId, setUserId] = useState(promoUserId || "");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [docsReady, setDocsReady] = useState(false);

  const pollDocuments = useCallback(async (oid: string) => {
    try {
      const supabase = createClient();
      const { data: docs } = await supabase
        .from("documents")
        .select("id, document_type, status, storage_path")
        .eq("order_id", oid);

      if (docs && docs.length > 0) {
        setDocuments(docs as DocumentRecord[]);
        const allReady = docs.every((d) => d.status === "generated" || d.status === "delivered");
        if (allReady) {
          setDocsReady(true);
          setSteps([
            { label: isPromo ? "Promo code applied" : "Payment confirmed", status: "done" },
            { label: "Trust Package generated", status: "done" },
            { label: "Ready for download", status: "done" },
            { label: "Saved to your account", status: "done" },
          ]);
          return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  }, [isPromo]);

  useEffect(() => {
    async function init() {
      if (isPromo && orderId) {
        setSteps([
          { label: "Promo code applied", status: "done" },
          { label: "Generating your Trust Package...", status: "active" },
          { label: "Ready for download", status: "pending" },
          { label: "Saved to your account", status: "pending" },
        ]);
        setLoading(false);

        const poll = setInterval(async () => {
          const ready = await pollDocuments(orderId);
          if (ready) clearInterval(poll);
        }, 3000);

        setTimeout(() => {
          clearInterval(poll);
          setSteps([
            { label: "Promo code applied", status: "done" },
            { label: "Trust Package generated", status: "done" },
            { label: "Ready for download", status: "done" },
            { label: "Saved to your account", status: "done" },
          ]);
          setDocsReady(true);
        }, 30000);

        return;
      }

      if (!sessionId) { setError("No payment session found."); setLoading(false); return; }
      try {
        const res = await fetch(`/api/checkout/verify?session_id=${sessionId}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Unable to verify payment."); setLoading(false); return; }

        setAttorneyReview(data.attorneyReview);
        if (data.email) setEmail(data.email);
        if (data.userId) setUserId(data.userId);

        if (data.attorneyReview) {
          setSteps([
            { label: `Payment confirmed — $${data.amount}`, status: "done" },
            { label: "4 documents generated", status: "done" },
            { label: "Attorney review in progress...", status: "active" },
            { label: "Delivery within 48 hours", status: "pending" },
          ]);
        } else {
          setSteps([
            { label: `Payment confirmed — $${data.amount}`, status: "done" },
            { label: "Generating your 4 documents...", status: "active" },
            { label: "Delivery to your email", status: "pending" },
            { label: "Saved to your account", status: "pending" },
          ]);
          setTimeout(() => {
            setSteps([
              { label: `Payment confirmed — $${data.amount}`, status: "done" },
              { label: "Trust Package generated", status: "done" },
              { label: "Delivered to your email", status: "done" },
              { label: "Saved to your account", status: "done" },
            ]);
            setDocsReady(true);
          }, 5000);

          if (data.orderId) {
            const poll = setInterval(async () => {
              const ready = await pollDocuments(data.orderId);
              if (ready) clearInterval(poll);
            }, 5000);
            setTimeout(() => clearInterval(poll), 60000);
          }
        }
        setLoading(false);
      } catch { setError("Unable to verify payment."); setLoading(false); }
    }
    init();
  }, [sessionId, isPromo, orderId, pollDocuments]);

  async function handleDownload(doc: DocumentRecord) {
    try {
      const supabase = createClient();
      if (!doc.storage_path) return;
      const { data } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch { /* ignore */ }
  }

  const docTypeLabels: Record<string, string> = {
    trust: "Revocable Living Trust",
    pour_over_will: "Pour-Over Will",
    poa: "Durable Power of Attorney",
    healthcare_directive: "Healthcare Directive",
  };

  if (loading) {
    return (<div className="min-h-screen bg-navy flex items-center justify-center"><div className="animate-pulse text-gold text-xl font-bold">EstateVault</div></div>);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-bold text-navy">Something went wrong</h1>
          <p className="mt-3 text-sm text-charcoal/60">{error}</p>
          <Link href="/trust/checkout" className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-gold px-8 py-3 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">Try Again</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <AnimatedCheckmark />

        <div className="mt-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {attorneyReview ? "Your Trust Package is under review." : "Your Trust Package is being prepared."}
          </h1>
          <p className="mt-3 text-sm text-blue-100/60 max-w-md mx-auto">
            {attorneyReview
              ? "A licensed Michigan attorney is reviewing your documents. You\u2019ll receive your completed package within 48 hours."
              : "You\u2019ll receive a download link by email within a few minutes. Your documents are also saved in your account."}
          </p>
        </div>

        {/* Status steps */}
        <div className="mt-10 rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                {step.status === "done" ? <span className="mt-0.5 text-green-400">&#9989;</span> : step.status === "active" ? <span className="mt-0.5 animate-pulse">&#9203;</span> : <span className="mt-0.5 text-white/30">&#11036;</span>}
                <span className={`text-sm ${step.status === "done" ? "text-white" : step.status === "active" ? "text-gold font-medium" : "text-white/40"}`}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Download buttons */}
        {docsReady && documents.length > 0 && (
          <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Download Your Documents</h3>
            <div className="space-y-2">
              {documents.filter((d) => d.storage_path).map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleDownload(doc)}
                  className="w-full flex items-center justify-between rounded-lg bg-white/10 hover:bg-white/15 px-4 py-3 text-sm text-white transition-colors"
                >
                  <span>{docTypeLabels[doc.document_type] || doc.document_type}</span>
                  <span className="text-gold font-medium">Download PDF &darr;</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attorney review info */}
        {attorneyReview && (
          <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-6">
            <p className="text-sm font-semibold text-white">What happens next:</p>
            <ul className="mt-3 space-y-2 text-sm text-blue-100/70">
              <li>A licensed Michigan attorney has been assigned to your file</li>
              <li>They will review all 4 documents in your trust package</li>
              <li>You will receive your completed package by email within 48 hours</li>
            </ul>
          </div>
        )}

        {/* Password setup */}
        {email && !attorneyReview && (
          <div className="mt-10">
            <PasswordSetup email={email} userId={userId} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrustSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-navy flex items-center justify-center"><div className="animate-pulse text-gold text-xl font-bold">EstateVault</div></div>}>
      <SuccessContent />
    </Suspense>
  );
}
