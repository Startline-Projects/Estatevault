"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Step1Page() {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<"standard" | "enterprise">("standard");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sliderValue, setSliderValue] = useState(5);
  const [partnerId, setPartnerId] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/pro/login"); return; }
      const { data: partner } = await supabase.from("partners").select("id, tier, annual_fee_paid, one_time_fee_paid, professional_type").eq("profile_id", user.id).single();
      if (partner) {
        setPartnerId(partner.id);
        if (partner.tier) setSelectedTier(partner.tier as "standard" | "enterprise");
        // Skip payment step for attorneys who paid one-time fee or any partner who paid annual fee
        if (partner.annual_fee_paid || partner.one_time_fee_paid) { router.push("/pro/onboarding/step-2"); return; }
      }
    }
    load();
  }, [router]);

  const earningsPerTrust = selectedTier === "enterprise" ? 450 : 400;
  const annualFee = selectedTier === "enterprise" ? 6000 : 1200;
  const monthlyEarnings = sliderValue * earningsPerTrust;
  const annualEarnings = monthlyEarnings * 12;
  const netProfit = annualEarnings - annualFee;

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
    { tier: "standard" as const, name: "Standard", price: "$1,200/year", badge: null, features: ["Unlimited will and trust documents", "Branded white-label platform", "Custom subdomain (legacy.yourdomain.com)", "Branded email delivery", "3 team seats", "Partner earnings: $300/will · $400/trust", "Email and chat support", "Marketing toolkit"], btnClass: "bg-navy text-white hover:bg-navy/90" },
    { tier: "enterprise" as const, name: "Enterprise", price: "$6,000/year", badge: "Most Popular for Agencies", features: ["Everything in Standard", "Lower EstateVault cut: $50/will · $150/trust", "Partner earnings: $350/will · $450/trust", "Custom domain support", "10 team seats", "Custom commission hierarchy for sub-agents", "Dedicated account manager", "Attorney review tier included (10/month)"], btnClass: "bg-gold text-white hover:bg-gold/90" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Choose Your Plan</h1>
      <p className="mt-1 text-sm text-charcoal/60">Both plans include unlimited documents and full platform access.</p>

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
          <div><p className="text-xs text-charcoal/50">Platform fee</p><p className="text-lg font-bold text-charcoal/60">${annualFee.toLocaleString()}</p></div>
          <div><p className="text-xs text-charcoal/50">Net annual profit</p><p className={`text-lg font-bold ${netProfit > 0 ? "text-green-600" : "text-red-600"}`}>${netProfit.toLocaleString()}</p></div>
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
        <a href="/legal/partner-agreement" className="mt-2 block text-xs text-navy/60 hover:text-gold">View full Partner Agreement</a>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <button onClick={handleGetStarted} disabled={!agreed || loading} className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {loading ? "Redirecting to payment..." : `Get Started — ${selectedTier === "enterprise" ? "$6,000" : "$1,200"}/year`}
      </button>
    </div>
  );
}
