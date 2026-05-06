"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Step3Page() {
  const router = useRouter();
  const [tier, setTier] = useState("standard");
  const [isAttorney, setIsAttorney] = useState(false);
  const [hasInhouseAttorney, setHasInhouseAttorney] = useState<boolean | null>(null);
  const [inhouseAttorneyName, setInhouseAttorneyName] = useState("");
  const [inhouseAttorneyEmail, setInhouseAttorneyEmail] = useState("");
  const [inhouseAttorneyBar, setInhouseAttorneyBar] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [partnerId, setPartnerId] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase
        .from("partners")
        .select("id, tier, professional_type, has_inhouse_estate_attorney")
        .eq("profile_id", user.id)
        .single();
      if (partner) {
        setPartnerId(partner.id);
        setTier(partner.tier || "standard");
        setIsAttorney(partner.professional_type === "attorney");
        if (partner.has_inhouse_estate_attorney !== null && partner.has_inhouse_estate_attorney !== undefined) {
          setHasInhouseAttorney(partner.has_inhouse_estate_attorney);
        }
      }
    }
    load();
  }, []);

  const isEnterprise = tier === "enterprise";
  const willEarnings = isEnterprise ? "$350" : "$300";
  const trustEarnings = isEnterprise ? "$450" : "$400";
  const amendEarnings = "$10";
  const scenarioEarnings = isEnterprise ? "$2,250" : "$2,000";

  async function handleContinue() {
    if (!accepted) return;
    if (isAttorney && hasInhouseAttorney === null) return;
    const supabase = createClient();

    // Save in-house attorney selection
    if (isAttorney) {
      const updateData: Record<string, unknown> = {
        has_inhouse_estate_attorney: hasInhouseAttorney === true,
        onboarding_step: 4,
      };

      // If they have an in-house attorney, create a profile for that attorney
      if (hasInhouseAttorney && inhouseAttorneyEmail) {
        // Create the review attorney user via admin API
        const res = await fetch("/api/partners/create-review-attorney", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partnerId,
            attorneyName: inhouseAttorneyName,
            attorneyEmail: inhouseAttorneyEmail,
            barNumber: inhouseAttorneyBar,
          }),
        });
        if (res.ok) {
          const { profileId } = await res.json();
          updateData.inhouse_review_attorney_id = profileId;
        }
      }

      await supabase.from("partners").update(updateData).eq("id", partnerId);
    } else {
      await supabase.from("partners").update({ onboarding_step: 4 }).eq("id", partnerId);
    }

    router.push("/pro/onboarding/step-4");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Your Pricing</h1>
      <p className="mt-1 text-sm text-charcoal/60">EstateVault sets the prices, this keeps the product premium and your earnings consistent.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white border border-gray-200 p-6">
          <h3 className="text-base font-bold text-navy">Will Package</h3>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-charcoal/60">Client pays</span><span className="font-semibold text-navy">$400</span></div>
            <div className="flex justify-between"><span className="text-charcoal/60">Your earnings</span><span className="font-semibold text-green-600">{willEarnings}</span></div>
          </div>
        </div>
        <div className="rounded-xl bg-white border border-gray-200 p-6">
          <h3 className="text-base font-bold text-navy">Trust Package</h3>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-charcoal/60">Client pays</span><span className="font-semibold text-navy">$600</span></div>
            <div className="flex justify-between"><span className="text-charcoal/60">Your earnings</span><span className="font-semibold text-green-600">{trustEarnings}</span></div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {isAttorney ? (
          <div className="rounded-xl bg-white border border-gray-200 p-6">
            <h3 className="text-base font-bold text-navy">Attorney Review Add-On</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-charcoal/60">Client pays</span><span className="font-semibold text-navy">$300</span></div>
              <div className="flex justify-between"><span className="text-charcoal/60">Your earnings</span><span className="font-semibold text-green-600">$300</span></div>
            </div>
            <p className="mt-3 text-xs text-charcoal/60">As a reviewing attorney, you earn 100% of the review fee when clients in your network request attorney review.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white border border-gray-200 p-6">
            <h3 className="text-base font-bold text-navy">Attorney Review Add-On</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-charcoal/60">Client pays</span><span className="font-semibold text-navy">$300</span></div>
              <div className="flex justify-between"><span className="text-charcoal/60">Goes to</span><span className="text-charcoal/50">Reviewing attorney</span></div>
            </div>
            <p className="mt-3 text-xs text-charcoal/60">Attorney review fees go directly to the reviewing attorney. This protects you from any fee-splitting concerns.</p>
          </div>
        )}
        <div className="rounded-xl bg-white border border-gray-200 p-6">
          <h3 className="text-base font-bold text-navy">Document Amendment</h3>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-charcoal/60">Client pays</span><span className="font-semibold text-navy">$50</span></div>
            <div className="flex justify-between"><span className="text-charcoal/60">Your earnings</span><span className="font-semibold text-green-600">{amendEarnings}</span></div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-6 text-center">
        <p className="text-sm text-charcoal/60">If you facilitate 5 trust packages this month:</p>
        <p className="mt-2 text-3xl font-bold text-navy">{scenarioEarnings}</p>
        <p className="text-xs text-charcoal/60">in monthly earnings, paid instantly per sale</p>
      </div>

      {/* In-House Attorney Decision Card (attorneys only) */}
      {isAttorney && (
        <div className="mt-8 rounded-xl bg-white border-2 border-navy/10 p-6">
          <h3 className="text-base font-bold text-navy">In-House Attorney Review</h3>
          <p className="mt-1 text-sm text-charcoal/60">
            Does your firm have a licensed estate planning attorney on staff who will review
            documents for your clients?
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setHasInhouseAttorney(true)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                hasInhouseAttorney === true
                  ? "border-gold bg-gold/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="text-sm font-semibold text-navy">Yes, we have an estate attorney</p>
              <p className="mt-1 text-xs text-charcoal/50">
                Reviews are handled in-house. The $300 review fee goes to your firm.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setHasInhouseAttorney(false)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                hasInhouseAttorney === false
                  ? "border-gold bg-gold/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="text-sm font-semibold text-navy">No, use EstateVault&apos;s attorney</p>
              <p className="mt-1 text-xs text-charcoal/50">
                Reviews are handled by EstateVault&apos;s in-house counsel at no cost to your firm.
              </p>
            </button>
          </div>

          {/* Attorney details form (shown when Yes is selected) */}
          {hasInhouseAttorney === true && (
            <div className="mt-4 space-y-3 rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium text-navy">Attorney Details</p>
              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1">Full Name</label>
                <input
                  type="text"
                  value={inhouseAttorneyName}
                  onChange={(e) => setInhouseAttorneyName(e.target.value)}
                  placeholder="Jane Smith, Esq."
                  className="w-full min-h-[40px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1">Email Address</label>
                <input
                  type="email"
                  value={inhouseAttorneyEmail}
                  onChange={(e) => setInhouseAttorneyEmail(e.target.value)}
                  placeholder="attorney@yourfirm.com"
                  className="w-full min-h-[40px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1">Bar Number</label>
                <input
                  type="text"
                  value={inhouseAttorneyBar}
                  onChange={(e) => setInhouseAttorneyBar(e.target.value)}
                  placeholder="e.g. P-12345"
                  className="w-full min-h-[40px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </div>
              <p className="text-xs text-charcoal/60">
                This attorney will receive review assignments and must have an active bar membership.
                You can change this later in Settings.
              </p>
            </div>
          )}
        </div>
      )}

      <label className="mt-6 flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 rounded accent-gold" />
        <span className="text-sm text-charcoal">I understand and accept the EstateVault pricing structure</span>
      </label>

      <button onClick={handleContinue} disabled={!accepted || (isAttorney && hasInhouseAttorney === null) || (isAttorney && hasInhouseAttorney === true && !inhouseAttorneyEmail)} className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
    </div>
  );
}
