"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AnimatedCheckmark from "@/components/success/AnimatedCheckmark";
import CheckEmailCTA from "@/components/success/CheckEmailCTA";

type Step = { label: string; status: "done" | "active" | "pending" };

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [attorneyReview, setAttorneyReview] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function verifyPayment() {
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

        if (data.attorneyReview) {
          setSteps([
            { label: `Payment confirmed \u2014 $${data.amount}`, status: "done" },
            { label: "Documents generated", status: "done" },
            { label: "Attorney review in progress (48hr SLA)", status: "active" },
            { label: "Delivery to your email", status: "pending" },
          ]);
        } else {
          setSteps([
            { label: "Payment confirmed", status: "done" },
            { label: "Generating your Will Package...", status: "active" },
            { label: "Delivery to your email", status: "pending" },
            { label: "Saved to your account", status: "pending" },
          ]);

          setTimeout(() => {
            setSteps([
              { label: "Payment confirmed", status: "done" },
              { label: "Will Package generated", status: "done" },
              { label: "Delivered to your email", status: "done" },
              { label: "Saved to your account", status: "done" },
            ]);
          }, 5000);
        }

        setLoading(false);
      } catch {
        setError("Unable to verify payment. Please check your email.");
        setLoading(false);
      }
    }

    verifyPayment();
  }, [sessionId]);

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
                {step.status === "done" ? (
                  <span className="mt-0.5 text-green-400">✅</span>
                ) : step.status === "active" ? (
                  <span className="mt-0.5 animate-pulse">⏳</span>
                ) : (
                  <span className="mt-0.5 text-white/30">⬜</span>
                )}
                <span className={`text-sm ${step.status === "done" ? "text-white" : step.status === "active" ? "text-gold font-medium" : "text-white/40"}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Check email CTA */}
        <div className="mt-10">
          <CheckEmailCTA email={email} />
        </div>
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
