"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ComplexityResult } from "@/lib/trust-types";

const trustFeatures = [
  "Revocable Living Trust",
  "Pour-Over Will",
  "Durable Power of Attorney",
  "Healthcare Directive",
  "Asset Funding Checklist",
  "Family Vault Access",
];

export default function TrustCheckoutPage() {
  const router = useRouter();
  const [attorneyReview, setAttorneyReview] = useState(false);
  const [complexity, setComplexity] = useState<ComplexityResult>({ flagged: false, reasons: [] });
  const [declineAck, setDeclineAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const total = attorneyReview ? 900 : 600;

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login?redirect=/trust"); return; }
      setUserId(user.id);

      const intake = sessionStorage.getItem("trustIntake");
      if (!intake) { router.push("/trust"); return; }

      const comp = sessionStorage.getItem("trustComplexity");
      if (comp) {
        const parsed = JSON.parse(comp) as ComplexityResult;
        setComplexity(parsed);
        if (parsed.flagged) setAttorneyReview(true); // pre-check
      }
    }
    init();
  }, [router]);

  const showDeclineWarning = complexity.flagged && !attorneyReview;

  async function handlePayment() {
    if (showDeclineWarning && !declineAck) return;
    setLoading(true);
    setError("");

    try {
      const intake = sessionStorage.getItem("trustIntake");
      if (!intake) { router.push("/trust"); return; }

      const res = await fetch("/api/checkout/trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          attorneyReview,
          intakeAnswers: JSON.parse(intake),
          complexityFlag: complexity.flagged,
          complexityReasons: complexity.reasons,
          declinedAttorneyReview: complexity.flagged && !attorneyReview,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); setLoading(false); return; }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-navy px-6 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-white">EstateVault</Link>
          <span className="text-sm text-white/60">Secure Checkout</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10">
        {/* Order summary */}
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-sm">
          <div className="bg-navy px-6 py-4"><h1 className="text-lg font-bold text-white">Order Summary</h1></div>
          <div className="p-6">
            <h2 className="text-lg font-bold text-navy">Trust Package</h2>
            <ul className="mt-4 space-y-2.5">
              {trustFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-charcoal/80">
                  <span className="mt-0.5 text-gold font-bold">&#10003;</span>{f}
                </li>
              ))}
            </ul>
            <hr className="my-6 border-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-charcoal">Trust Package</span>
              <span className="text-sm font-bold text-navy">$600</span>
            </div>
            {attorneyReview && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-medium text-charcoal">Attorney Review</span>
                <span className="text-sm font-bold text-navy">$300</span>
              </div>
            )}
            <hr className="my-4 border-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-navy">Total</span>
              <span className="text-2xl font-bold text-navy">${total}</span>
            </div>
          </div>
        </div>

        {/* Attorney review upsell */}
        <div className={`mt-6 rounded-2xl bg-white border ${complexity.flagged ? "border-amber-300" : "border-gray-200"} p-6 shadow-sm`}>
          {complexity.flagged ? (
            <>
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚖</span>
                <div>
                  <h3 className="text-base font-bold text-navy">Attorney Review — Recommended</h3>
                  <p className="mt-2 text-sm text-charcoal/60 leading-relaxed">
                    Based on your answers, your situation has some complexity
                    ({complexity.reasons.join(", ").toLowerCase()}) that benefits
                    from attorney review.
                  </p>
                  <p className="mt-2 text-sm text-charcoal/60">
                    A licensed Michigan attorney will review your trust before
                    delivery. 48-hour turnaround. $300.
                  </p>
                </div>
              </div>
              <label className="mt-4 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attorneyReview}
                  onChange={(e) => { setAttorneyReview(e.target.checked); setDeclineAck(false); }}
                  className="h-5 w-5 rounded border-gray-300 accent-gold"
                />
                <span className="text-sm font-medium text-navy">Add Attorney Review</span>
              </label>
              {showDeclineWarning && (
                <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-sm text-amber-800">
                    You&apos;re choosing to proceed without attorney review. By
                    continuing you acknowledge your situation was flagged as
                    complex.
                  </p>
                  <label className="mt-3 flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={declineAck}
                      onChange={(e) => setDeclineAck(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-gray-300 accent-gold"
                    />
                    <span className="text-sm text-amber-900">
                      I understand and wish to proceed without attorney review
                    </span>
                  </label>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚖</span>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-navy">Add Attorney Review — $300</h3>
                  <p className="mt-1 text-sm text-charcoal/60 leading-relaxed">
                    A licensed Michigan attorney will personally review your
                    trust before delivery. (48hr turnaround)
                  </p>
                </div>
              </div>
              <label className="mt-4 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attorneyReview}
                  onChange={(e) => setAttorneyReview(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 accent-gold"
                />
                <span className="text-sm font-medium text-navy">Add Attorney Review</span>
              </label>
              {attorneyReview && (
                <p className="mt-3 text-xs text-charcoal/50">
                  Attorney review fee goes directly to your reviewing attorney.
                </p>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={handlePayment}
          disabled={loading || (showDeclineWarning && !declineAck)}
          className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-4 text-base font-semibold text-white hover:bg-gold/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Redirecting to payment..." : `Proceed to Payment \u2014 $${total}`}
        </button>
        <p className="mt-3 text-center text-xs text-charcoal/40">🔒 Secure payment powered by Stripe</p>
      </div>
    </div>
  );
}
