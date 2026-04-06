"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Step1Page() {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<"standard" | "enterprise">("standard");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [error, setError] = useState("");
  const [sliderValue, setSliderValue] = useState(5);
  const [partnerId, setPartnerId] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
      const { data: partner } = await supabase.from("partners").select("id, tier, annual_fee_paid, one_time_fee_paid, professional_type, promo_code").eq("profile_id", user.id).single();
      if (partner) {
        setPartnerId(partner.id);
        if (partner.tier) setSelectedTier(partner.tier as "standard" | "enterprise");
        // Skip payment step if platform fee already paid, or promo code waives it
        if (partner.annual_fee_paid || partner.one_time_fee_paid) { router.push("/pro/onboarding/step-2"); return; }
        if (partner.promo_code && partner.promo_code.toUpperCase() === "FREE676") {
          // Mark fee as paid via promo and skip to step 2
          await supabase.from("partners").update({ one_time_fee_paid: true, onboarding_step: 2 }).eq("id", partner.id);
          router.push("/pro/onboarding/step-2");
          return;
        }
      }
    }
    load();
  }, [router]);

  const earningsPerTrust = selectedTier === "enterprise" ? 450 : 400;
  const platformFee = selectedTier === "enterprise" ? 6000 : 1200;
  const monthlyEarnings = sliderValue * earningsPerTrust;
  const annualEarnings = monthlyEarnings * 12;
  const netFirstYearProfit = annualEarnings - platformFee;

  async function handleGetStarted() {
    if (!agreed) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/checkout/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, tier: selectedTier }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return; }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  const plans = [
    { tier: "standard" as const, name: "Standard", price: "$1,200 one-time", badge: null, features: ["Unlimited will and trust documents", "Branded white-label platform", "Custom subdomain (legacy.yourdomain.com)", "Branded email delivery", "3 team seats", "Partner earnings: $300/will · $400/trust", "Email and chat support", "Marketing toolkit"], btnClass: "bg-navy text-white hover:bg-navy/90" },
    { tier: "enterprise" as const, name: "Enterprise", price: "$6,000 one-time", badge: "Most Popular for Agencies", features: ["Everything in Standard", "Lower EstateVault cut: $50/will · $150/trust", "Partner earnings: $350/will · $450/trust", "Custom domain support", "10 team seats", "Custom commission hierarchy for sub-agents", "Dedicated account manager", "Attorney review tier included (10/month)"], btnClass: "bg-gold text-white hover:bg-gold/90" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Choose Your Plan</h1>
      <p className="mt-1 text-sm text-charcoal/60">Both plans include unlimited documents and full platform access. One-time fee, no recurring charges.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <div key={plan.tier} onClick={() => setSelectedTier(plan.tier)} className={`relative rounded-2xl bg-white border-2 p-6 cursor-pointer transition-all ${selectedTier === plan.tier ? "border-gold shadow-md" : "border-gray-200 hover:border-gold/40"}`}>
            {plan.badge && <span className="absolute -top-3 right-4 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">{plan.badge}</span>}
            <h3 className="text-lg font-bold text-navy">{plan.name}</h3>
            <p className="text-2xl font-bold text-navy mt-1">{plan.price}</p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-charcoal/70"><span className="text-gold mt-0.5">✓</span>{f}</li>)}
            </ul>
            <button onClick={(e) => { e.stopPropagation(); setSelectedTier(plan.tier); }} className={`mt-6 w-full min-h-[44px] rounded-full py-3 text-sm font-semibold transition-colors ${selectedTier === plan.tier ? plan.btnClass : "bg-gray-100 text-charcoal/50"}`}>
              {selectedTier === plan.tier ? "Selected" : "Select"}
            </button>
          </div>
        ))}
      </div>

      {/* ROI Calculator */}
      <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 p-6">
        <h3 className="text-base font-bold text-navy">How quickly does this pay for itself?</h3>
        <label className="mt-4 block text-sm text-charcoal/70">Estimated trust packages per month: <span className="font-bold text-navy">{sliderValue}</span></label>
        <input type="range" min={1} max={50} value={sliderValue} onChange={(e) => setSliderValue(parseInt(e.target.value))} className="mt-2 w-full accent-gold" />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div><p className="text-xs text-charcoal/50">Monthly earnings</p><p className="text-lg font-bold text-navy">${monthlyEarnings.toLocaleString()}</p></div>
          <div><p className="text-xs text-charcoal/50">Annual earnings</p><p className="text-lg font-bold text-navy">${annualEarnings.toLocaleString()}</p></div>
          <div><p className="text-xs text-charcoal/50">One-time platform fee</p><p className="text-lg font-bold text-charcoal/60">${platformFee.toLocaleString()}</p></div>
          <div><p className="text-xs text-charcoal/50">First-year net profit</p><p className={`text-lg font-bold ${netFirstYearProfit > 0 ? "text-green-600" : "text-red-600"}`}>${netFirstYearProfit.toLocaleString()}</p></div>
        </div>
      </div>

      {/* Partner Agreement */}
      <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 p-6">
        <p className="text-sm font-semibold text-navy">Before proceeding, please review our Partner Agreement.</p>
        <ul className="mt-3 space-y-2 text-sm text-charcoal/70">
          <li>• You agree that this platform provides document preparation services only — not legal advice</li>
          <li>• You will not provide legal advice to clients using this platform</li>
          <li>• You agree to complete platform certification before facilitating client sessions</li>
        </ul>
        <label className="mt-4 flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 rounded accent-gold" />
          <span className="text-sm text-charcoal">I have read and agree to the Partner Agreement</span>
        </label>
        <button onClick={() => setShowAgreement(true)} className="mt-2 block text-xs text-navy/60 hover:text-gold">View full Partner Agreement</button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <button onClick={handleGetStarted} disabled={!agreed || loading} className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {loading ? "Redirecting to payment..." : `Get Started — ${selectedTier === "enterprise" ? "$6,000" : "$1,200"} one-time`}
      </button>

      {showAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAgreement(false)}>
          <div className="relative mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAgreement(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <h2 className="text-xl font-bold text-navy">EstateVault Partner Agreement</h2>
            <p className="mt-1 text-xs text-charcoal/40">Last updated: April 2026</p>

            <div className="mt-6 space-y-6 text-sm text-charcoal/80 leading-relaxed">
              <section>
                <h3 className="font-semibold text-navy">1. Scope of Services</h3>
                <p className="mt-2">EstateVault provides a white-label estate planning document preparation platform. Partners are authorized to offer this platform to their clients under their own branding. This platform generates documents based on client-provided information and does not constitute legal advice.</p>
              </section>

              <section>
                <h3 className="font-semibold text-navy">2. Partner Responsibilities</h3>
                <p className="mt-2">Partners agree to: (a) complete platform certification before facilitating client sessions; (b) not provide legal advice through the platform; (c) ensure clients sign the required acknowledgment form before document generation; (d) maintain accurate business and contact information.</p>
              </section>

              <section>
                <h3 className="font-semibold text-navy">3. Fees & Revenue</h3>
                <p className="mt-2">Partners pay a one-time platform fee upon enrollment. Revenue from client document purchases is split between EstateVault and the Partner according to the selected tier (Standard or Enterprise). Detailed revenue splits are provided during onboarding.</p>
              </section>

              <section>
                <h3 className="font-semibold text-navy">4. Client Data & Privacy</h3>
                <p className="mt-2">All client data is stored securely and encrypted. Partners may only access client data for clients they have directly onboarded. Partners must not share, export, or misuse client information outside the platform.</p>
              </section>

              <section>
                <h3 className="font-semibold text-navy">5. Termination</h3>
                <p className="mt-2">Either party may terminate this agreement with 30 days written notice. Upon termination, the Partner&apos;s access to the platform will be revoked. Existing client accounts and documents will remain accessible to the clients directly.</p>
              </section>

              <section>
                <h3 className="font-semibold text-navy">6. Limitation of Liability</h3>
                <p className="mt-2">EstateVault is not responsible for any legal outcomes arising from documents generated through the platform. The platform provides document preparation services only. Partners and clients are advised to seek independent legal counsel for complex estate planning needs.</p>
              </section>

              <p className="mt-4 text-xs text-charcoal/40 italic">This is a summary of the Partner Agreement. The full legal terms will be provided upon enrollment.</p>
            </div>

            <button onClick={() => setShowAgreement(false)} className="mt-6 w-full rounded-full bg-navy py-3 text-sm font-semibold text-white hover:bg-navy/90 transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
