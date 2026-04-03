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
  const isTest = searchParams.get("test") === "true";
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
  const [hasExistingAccount, setHasExistingAccount] = useState(false);

  const pollDocuments = useCallback(async (oid: string) => {
    try {
      if (isTest) {
        // Test mode: use server-side API (no auth, bypasses RLS)
        const res = await fetch(`/api/documents/check-status?order_id=${oid}`);
        const data = await res.json();
        if (data.ready && data.documents.length > 0) {
          setDocuments(data.documents.map((d: { id: string; document_type: string; status: string; has_file: boolean }) => ({
            id: d.id, document_type: d.document_type, status: d.status, storage_path: d.has_file ? "exists" : null,
          })));
          setDocsReady(true);
          setSteps([
            { label: "Promo code applied", status: "done" },
            { label: "Will Package generated", status: "done" },
            { label: "Ready for download", status: "done" },
            { label: "Test Mode — not saved", status: "done" },
          ]);
          return true;
        }
        return false;
      }

      // Normal flow: use client-side Supabase
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
            { label: "Will Package generated", status: "done" },
            { label: "Ready for download", status: "done" },
            { label: "Saved to your account", status: "done" },
          ]);
          return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  }, [isPromo, isTest]);

  useEffect(() => {
    async function init() {
      if ((isPromo || isTest) && orderId) {
        const lastStep = isTest ? "Test Mode — not saved" : "Saved to your account";
        setSteps([
          { label: "Promo code applied", status: "done" },
          { label: "Generating your Will Package...", status: "active" },
          { label: "Ready for download", status: "pending" },
          { label: lastStep, status: "pending" },
        ]);
        setLoading(false);

        // Trigger document generation (fire-and-forget — don't await)
        fetch(`/api/documents/process-now?order_id=${orderId}`).catch(() => {});

        // Poll for document readiness
        const poll = setInterval(async () => {
          const ready = await pollDocuments(orderId);
          if (ready) clearInterval(poll);
        }, 5000);

        setTimeout(() => clearInterval(poll), 300000);

        return;
      }

      // Normal Stripe flow
      if (!sessionId) {
        setError("No payment session found.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/checkout/verify?session_id=${sessionId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Unable to verify payment.");
          setLoading(false);
          return;
        }

        setAttorneyReview(data.attorneyReview);
        if (data.email) setEmail(data.email);
        if (data.userId) setUserId(data.userId);
        if (data.hasExistingAccount) setHasExistingAccount(true);

        if (data.attorneyReview) {
          setSteps([
            { label: `Payment confirmed — $${data.amount}`, status: "done" },
            { label: "Documents generated", status: "done" },
            { label: "Attorney review in progress (48hr SLA)", status: "active" },
            { label: "Delivery to your email", status: "pending" },
          ]);
        } else {
          setSteps([
            { label: "Payment confirmed", status: "done" },
            { label: "Generating your Will Package...", status: "active" },
            { label: "Ready for download", status: "pending" },
            { label: "Saved to your account", status: "pending" },
          ]);

          // Trigger document generation immediately
          if (data.orderId) {
            fetch(`/api/documents/process-now?order_id=${data.orderId}`).catch(() => {});

            const poll = setInterval(async () => {
              const ready = await pollDocuments(data.orderId);
              if (ready) clearInterval(poll);
            }, 5000);
            setTimeout(() => clearInterval(poll), 300000);
          }
        }

        setLoading(false);
      } catch {
        setError("Unable to verify payment. Please check your email.");
        setLoading(false);
      }
    }

    init();
  }, [sessionId, isPromo, orderId, pollDocuments]);

  async function handleDownload(doc: DocumentRecord) {
    try {
      const supabase = createClient();
      if (!doc.storage_path) return;
      const { data } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch { /* ignore */ }
  }

  const docTypeLabels: Record<string, string> = {
    will: "Last Will & Testament",
    poa: "Durable Power of Attorney",
    healthcare_directive: "Healthcare Directive",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="animate-pulse text-gold text-xl font-bold">EstateVault</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-bold text-navy">Something went wrong</h1>
          <p className="mt-3 text-sm text-charcoal/60">{error}</p>
          <Link href="/will/checkout" className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-gold px-8 py-3 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">
            Try Again
          </Link>
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
            {attorneyReview ? "Your documents are being reviewed." : "Your documents are being prepared."}
          </h1>
          <p className="mt-3 text-sm text-blue-100/60 max-w-md mx-auto">
            {isTest
              ? "Your documents are ready to download."
              : attorneyReview
              ? "A licensed Michigan attorney is reviewing your documents. You\u2019ll receive your completed package within 48 hours."
              : "You\u2019ll receive a download link by email within a few minutes. Your documents are also saved in your account."}
          </p>
        </div>

        {/* Status steps */}
        <div className="mt-10 rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                {step.status === "done" ? (
                  <span className="mt-0.5 text-green-400">&#9989;</span>
                ) : step.status === "active" ? (
                  <span className="mt-0.5 animate-pulse">&#9203;</span>
                ) : (
                  <span className="mt-0.5 text-white/30">&#11036;</span>
                )}
                <span className={`text-sm ${step.status === "done" ? "text-white" : step.status === "active" ? "text-gold font-medium" : "text-white/40"}`}>
                  {step.label}
                </span>
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

        {/* Test mode: ZIP download button */}
        {isTest && orderId && (
          <div className="mt-6">
            <button
              onClick={async () => {
                const intake = sessionStorage.getItem("willIntake") || sessionStorage.getItem("trustIntake");
                const parsed = intake ? JSON.parse(intake) : {};
                const fn = parsed.firstName || "Test";
                const ln = parsed.lastName || "User";
                const zipName = `Test - ${fn} ${ln}.zip`;
                const res = await fetch(`/api/documents/download-zip?order_id=${orderId}&first_name=${encodeURIComponent(fn)}&last_name=${encodeURIComponent(ln)}`);
                if (!res.ok) return;
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = zipName;
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={!docsReady || documents.filter((d) => d.storage_path).length === 0}
              className="w-full min-h-[48px] rounded-full bg-[#C9A84C] py-3.5 text-base font-semibold text-white hover:bg-[#C9A84C]/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {docsReady && documents.filter((d) => d.storage_path).length > 0 ? "Download Documents" : "Preparing your documents..."}
            </button>
          </div>
        )}

        {/* Test mode label */}
        {isTest && (
          <p className="mt-6 text-center text-xs text-white/30">Test Mode — Documents will not be saved</p>
        )}

        {/* Password setup — not shown in test mode or for existing accounts */}
        {email && !attorneyReview && !isTest && (
          <div className="mt-10">
            {hasExistingAccount ? (
              <div className="rounded-2xl bg-white/10 border border-white/10 p-8 text-center">
                <h2 className="text-lg font-bold text-white">Welcome back!</h2>
                <p className="mt-3 text-sm text-blue-100/60">
                  We found an existing account with this email. Your new documents have been added to your account.
                </p>
                <a
                  href="/login"
                  className="mt-6 inline-flex min-h-[48px] items-center rounded-full bg-[#C9A84C] px-8 py-3.5 text-base font-semibold text-white hover:bg-[#C9A84C]/90 transition-colors shadow-lg"
                >
                  Log In to View Your Documents
                </a>
              </div>
            ) : (
              <PasswordSetup email={email} userId={userId} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WillSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-navy flex items-center justify-center"><div className="animate-pulse text-gold text-xl font-bold">EstateVault</div></div>}>
      <SuccessContent />
    </Suspense>
  );
}
