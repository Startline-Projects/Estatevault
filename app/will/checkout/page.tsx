"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PartnerThemedShell, { usePartnerBranding } from "@/components/partner/PartnerThemedShell";

function BrandedWordmark({ className = "" }: { className?: string }) {
  const branding = usePartnerBranding();
  if (branding?.logoUrl) {
    return <img src={branding.logoUrl} alt={branding.companyName} className={`h-10 w-auto object-contain ${className}`} />;
  }
  return <span className={className}>{branding?.companyName || "EstateVault"}</span>;
}

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
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [promoEmail, setPromoEmail] = useState("");
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);
  const [partnerId, setPartnerId] = useState("");

  const total = promoApplied ? 0 : (attorneyReview ? 700 : 400);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setPromoEmail(user.email || "");
      }
      const intake = sessionStorage.getItem("willIntake");
      if (!intake) router.push("/will");
      setPartnerId(sessionStorage.getItem("willPartner") || "");
    }
    init();
  }, [router]);

  async function handleApplyPromo() {
    const code = promoCode.toUpperCase();
    if (code === "FREE134") {
      setPromoApplied(true); setIsTestMode(false); setAttorneyReview(false); setError("");
    } else if (code === "TEST") {
      // Validate server-side, don't expose test logic in client JS
      try {
        const res = await fetch("/api/admin/test-promo");
        const data = await res.json();
        if (data.active) {
          setPromoApplied(true); setIsTestMode(true); setAttorneyReview(false); setError("");
        } else {
          setError("This code is not valid"); setPromoApplied(false);
        }
      } catch { setError("This code is not valid"); setPromoApplied(false); }
    } else {
      setError("Invalid promo code."); setPromoApplied(false);
    }
  }

  function handlePromoSubmit() {
    if (!promoEmail.trim()) { setError("Please enter your email address."); return; }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(promoEmail)) { setError("Please enter a valid email address."); return; }
    setError("");
    // Show acknowledgment form before proceeding
    setShowAcknowledgment(true);
  }

  async function handleTestSubmit() {
    setLoading(true);
    setError("");
    try {
      const intake = sessionStorage.getItem("willIntake");
      if (!intake) { router.push("/will"); return; }
      const res = await fetch("/api/checkout/will", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: null, attorneyReview: false, intakeAnswers: JSON.parse(intake), promoCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); setLoading(false); return; }
      if (data.test) {
        router.push(`/will/success?test=true&order_id=${data.orderId}`);
        return;
      }
    } catch { setError("Something went wrong."); setLoading(false); }
  }

  async function handleAcknowledgmentAccepted() {
    setLoading(true);
    setError("");

    try {
      const intake = sessionStorage.getItem("willIntake");
      if (!intake) { router.push("/will"); return; }

      const res = await fetch("/api/checkout/will", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || null,
          attorneyReview: false,
          intakeAnswers: JSON.parse(intake),
          promoCode,
          email: promoEmail,
          partnerId: partnerId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); setLoading(false); setShowAcknowledgment(false); return; }

      if (data.free) {
        router.push(`/will/success?promo=true&order_id=${data.orderId}&email=${encodeURIComponent(data.email)}&user_id=${data.userId || ""}`);
        return;
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      setShowAcknowledgment(false);
    }
  }

  async function handlePayment() {
    setLoading(true);
    setError("");

    try {
      const intake = sessionStorage.getItem("willIntake");
      if (!intake) { router.push("/will"); return; }

      const res = await fetch("/api/checkout/will", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || null,
          attorneyReview,
          intakeAnswers: JSON.parse(intake),
          partnerId: partnerId || null,
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

  // Acknowledgment modal
  if (showAcknowledgment) {
    return (
      <PartnerThemedShell showHeader={false}>
      <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-8 flex justify-center"><BrandedWordmark className="text-2xl font-bold text-white" /></div>
          <div className="rounded-2xl bg-white p-8 shadow-xl">
            <h1 className="text-xl font-bold text-navy">Before We Begin</h1>
            <div className="mt-6 space-y-4 text-sm text-charcoal/70 leading-relaxed">
              <p>This platform provides document preparation services only. It does not provide legal advice. No attorney-client relationship is created by your use of this platform.</p>
              <p>The documents generated are based solely on the information you provide. You are responsible for ensuring all information is accurate and complete. You are responsible for properly executing your documents in accordance with Michigan law requirements.</p>
              <p>If your situation is complex, we recommend consulting a licensed Michigan estate planning attorney.</p>
            </div>
            <label className="mt-8 flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={ackChecked} onChange={(e) => setAckChecked(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-gray-300 accent-gold" />
              <span className="text-sm text-charcoal leading-relaxed">I understand and agree that this is a document preparation service only, not legal advice.</span>
            </label>
            {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
            <button
              onClick={handleAcknowledgmentAccepted}
              disabled={!ackChecked || loading}
              className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating your account..." : "I Agree, Continue"}
            </button>
            <button onClick={() => setShowAcknowledgment(false)} className="mt-3 w-full text-sm text-charcoal/50 hover:text-charcoal transition-colors">
              Go Back
            </button>
          </div>
        </div>
      </div>
      </PartnerThemedShell>
    );
  }

  return (
    <PartnerThemedShell showHeader={false}>
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link href="/" className="flex items-center"><BrandedWordmark className="text-lg font-bold text-navy" /></Link>
          <span className="text-sm text-charcoal/60">Secure Checkout</span>
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
                <li key={f} className="flex items-start gap-2 text-sm text-charcoal/80">
                  <span className="mt-0.5 text-gold font-bold">&#10003;</span>{f}
                </li>
              ))}
            </ul>
            <hr className="my-6 border-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-charcoal">Will Package</span>
              {promoApplied ? (
                <span className="text-sm font-bold">
                  <span className="line-through text-gray-400 mr-2">$400</span>
                  <span className="text-green-600">FREE</span>
                </span>
              ) : (
                <span className="text-sm font-bold text-navy">$400</span>
              )}
            </div>
            {!promoApplied && attorneyReview && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-medium text-charcoal">Attorney Review</span>
                <span className="text-sm font-bold text-navy">$300</span>
              </div>
            )}
            <hr className="my-4 border-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-navy">Total</span>
              <span className="text-2xl font-bold text-navy">{promoApplied ? <span className="text-green-600">$0</span> : `$${total}`}</span>
            </div>
            {promoApplied && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 font-medium text-center">
                Promo code applied, Will Package is free
              </div>
            )}
          </div>
        </div>

        {/* Promo code */}
        <div className="mt-6 rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-navy mb-3">Promo Code</h3>
          <div className="flex gap-2">
            <input type="text" value={promoCode} onChange={(e) => { setPromoCode(e.target.value); if (promoApplied) setPromoApplied(false); }} placeholder="Enter promo code" disabled={promoApplied} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold disabled:bg-gray-50" />
            <button onClick={handleApplyPromo} disabled={!promoCode.trim() || promoApplied} className="px-4 py-2.5 rounded-lg bg-navy text-sm font-medium text-white hover:bg-navy/90 transition-colors disabled:opacity-50">
              {promoApplied ? "Applied" : "Apply"}
            </button>
          </div>
        </div>

        {/* Email for promo orders (not shown for test mode) */}
        {promoApplied && !isTestMode && (
          <div className="mt-6 rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-navy mb-3">Your Email</h3>
            <p className="text-xs text-charcoal/50 mb-3">We&apos;ll use this to create your account.</p>
            <input type="email" value={promoEmail} onChange={(e) => setPromoEmail(e.target.value)} placeholder="your@email.com" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold" />
          </div>
        )}

        {/* Attorney review, hide when promo applied */}
        {!promoApplied && (
          <div className="mt-6 rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚖</span>
              <div className="flex-1">
                <h3 className="text-base font-bold text-navy">Attorney Review, $300</h3>
                <p className="mt-1 text-sm text-charcoal/60 leading-relaxed">A licensed Michigan attorney will personally review your documents before delivery. (48hr turnaround)</p>
              </div>
            </div>
            <label className="mt-4 flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={attorneyReview} onChange={(e) => setAttorneyReview(e.target.checked)} className="h-5 w-5 rounded border-gray-300 accent-gold" />
              <span className="text-sm font-medium text-navy">Add Attorney Review</span>
            </label>
            {attorneyReview && <p className="mt-3 text-xs text-charcoal/50">Attorney review fee goes directly to your reviewing attorney.</p>}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={isTestMode ? handleTestSubmit : (promoApplied ? handlePromoSubmit : handlePayment)}
          disabled={loading || (promoApplied && !isTestMode && !promoEmail.trim())}
          className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-4 text-base font-semibold text-white hover:bg-gold/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Processing..."
            : isTestMode ? "Generate Test Documents"
            : promoApplied ? "Get Your Documents, Free"
            : `Proceed to Payment, $${total}`
          }
        </button>
        {!promoApplied && <p className="mt-3 text-center text-xs text-charcoal/60">Secure payment powered by Stripe</p>}
      </div>
    </div>
    </PartnerThemedShell>
  );
}
