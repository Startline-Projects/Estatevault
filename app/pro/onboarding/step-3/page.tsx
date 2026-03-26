"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Step3Page() {
  const router = useRouter();
  const [tier, setTier] = useState("standard");
  const [accepted, setAccepted] = useState(false);
  const [partnerId, setPartnerId] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase.from("partners").select("id, tier").eq("profile_id", user.id).single();
      if (partner) { setPartnerId(partner.id); setTier(partner.tier || "standard"); }
    }
    load();
  }, []);

  const isEnterprise = tier === "enterprise";
  const willEarnings = isEnterprise ? "$350" : "$300";
  const trustEarnings = isEnterprise ? "$450" : "$400";
  const willFee = isEnterprise ? "$50" : "$100";
  const trustFee = isEnterprise ? "$150" : "$200";
  const amendEarnings = isEnterprise ? "$40" : "$35";
  const scenarioEarnings = isEnterprise ? "$2,250" : "$2,000";

  async function handleContinue() {
    if (!accepted) return;
    const supabase = createClient();
    await supabase.from("partners").update({ onboarding_step: 4 }).eq("id", partnerId);
    router.push("/pro/onboarding/step-4");
  }

  const packages = [
    { name: "Will Package", clientPays: "$400", earnings: willEarnings, fee: willFee },
    { name: "Trust Package", clientPays: "$600", earnings: trustEarnings, fee: trustFee },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Your Pricing</h1>
      <p className="mt-1 text-sm text-charcoal/60">EstateVault sets the prices — this keeps the product premium and your earnings consistent.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {packages.map((pkg) => (
          <div key={pkg.name} className="rounded-xl bg-white border border-gray-200 p-6">
            <h3 className="text-base font-bold text-navy">{pkg.name}</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-charcoal/60">Client pays</span><span className="font-semibold text-navy">{pkg.clientPays}</span></div>
              <div className="flex justify-between"><span className="text-charcoal/60">Your earnings</span><span className="font-semibold text-green-600">{pkg.earnings}</span></div>
              <div className="flex justify-between"><span className="text-charcoal/60">EstateVault fee</span><span className="text-charcoal/50">{pkg.fee}</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white border border-gray-200 p-6">
          <h3 className="text-base font-bold text-navy">Attorney Review Add-On</h3>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-charcoal/60">Client pays</span><span className="font-semibold text-navy">$300</span></div>
            <div className="flex justify-between"><span className="text-charcoal/60">Your earnings</span><span className="text-charcoal/50">$0</span></div>
            <div className="flex justify-between"><span className="text-charcoal/60">Goes to</span><span className="text-charcoal/50">Reviewing attorney</span></div>
          </div>
          <p className="mt-3 text-xs text-charcoal/40">Attorney review fees go directly to the reviewing attorney. This protects you from any fee-splitting concerns.</p>
        </div>
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
        <p className="text-xs text-charcoal/40">deposited to your account every Friday</p>
      </div>

      <label className="mt-6 flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 rounded accent-gold" />
        <span className="text-sm text-charcoal">I understand and accept the EstateVault pricing structure</span>
      </label>

      <button onClick={handleContinue} disabled={!accepted} className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
    </div>
  );
}
