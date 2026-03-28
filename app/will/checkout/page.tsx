"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const willFeatures = [
  "Last Will & Testament",
  "Durable Power of Attorney",
  "Healthcare Directive",
  "Execution Guide",
  "Family Vault Access",
];

export default function WillCheckoutPage() {
  const router = useRouter();
  const [attorneyReview, setAttorneyReview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const total = attorneyReview ? 700 : 400;

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
      // Verify intake data exists
      const intake = sessionStorage.getItem("willIntake");
      if (!intake) {
        router.push("/will");
      }
    }
    init();
  }, [router]);

  async function handlePayment() {
    setLoading(true);
    setError("");

    try {
      const intake = sessionStorage.getItem("willIntake");
      if (!intake) {
        router.push("/will");
        return;
      }

      const res = await fetch("/api/checkout/will", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || null,
          attorneyReview,
          intakeAnswers: JSON.parse(intake),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Redirect to Stripe
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy px-6 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-white">
            EstateVault
          </Link>
          <span className="text-sm text-white/60">Secure Checkout</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10">
        {/* Order summary */}
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-sm">
          <div className="bg-navy px-6 py-4">
            <h1 className="text-lg font-bold text-white">Order Summary</h1>
          </div>
          <div className="p-6">
            <h2 className="text-lg font-bold text-navy">Will Package</h2>
            <ul className="mt-4 space-y-2.5">
              {willFeatures.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-charcoal/80"
                >
                  <span className="mt-0.5 text-gold font-bold">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>
            <hr className="my-6 border-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-charcoal">
                Will Package
              </span>
              <span className="text-sm font-bold text-navy">$400</span>
            </div>
            {attorneyReview && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-medium text-charcoal">
                  Attorney Review
                </span>
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

        {/* Attorney review add-on */}
        <div className="mt-6 rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚖</span>
            <div className="flex-1">
              <h3 className="text-base font-bold text-navy">
                Attorney Review — $300
              </h3>
              <p className="mt-1 text-sm text-charcoal/60 leading-relaxed">
                A licensed Michigan attorney will personally review your
                documents before delivery. (48hr turnaround)
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
            <span className="text-sm font-medium text-navy">
              Add Attorney Review
            </span>
          </label>
          {attorneyReview && (
            <p className="mt-3 text-xs text-charcoal/50">
              Attorney review fee goes directly to your reviewing attorney.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={handlePayment}
          disabled={loading}
          className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-4 text-base font-semibold text-white hover:bg-gold/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Redirecting to payment..." : `Proceed to Payment — $${total}`}
        </button>
        <p className="mt-3 text-center text-xs text-charcoal/40">
          🔒 Secure payment powered by Stripe
        </p>
      </div>
    </div>
  );
}
