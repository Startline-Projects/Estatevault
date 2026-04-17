"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProPreviewPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [businessUrl, setBusinessUrl] = useState("");
  const [tier, setTier] = useState("standard");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
      const { data: partner } = await supabase.from("partners").select("company_name, business_url, tier").eq("profile_id", user.id).single();
      if (partner) {
        setCompanyName(partner.company_name || "Your Company");
        setBusinessUrl(partner.business_url || "yourcompany.com");
        setTier(partner.tier || "standard");
      }
    }
    load();
  }, [router]);

  const willEarnings = tier === "enterprise" ? "$350" : "$300";
  const trustEarnings = tier === "enterprise" ? "$450" : "$400";

  return (
    <div className="min-h-screen bg-navy px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Welcome to EstateVault <span className="text-gold">Pro</span>, {companyName}.
          </h1>
          <p className="mt-3 text-sm text-blue-100/60">Here&apos;s a preview of your white-label platform before you complete your setup.</p>
        </div>

        {/* Browser mockup */}
        <div className="mt-10 rounded-xl overflow-hidden shadow-2xl border border-white/10">
          <div className="bg-gray-800 px-4 py-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <div className="h-3 w-3 rounded-full bg-green-400" />
            </div>
            <div className="ml-4 flex-1 bg-gray-700 rounded-md px-3 py-1 text-xs text-gray-300">
              legacy.{businessUrl}
            </div>
          </div>
          <div className="bg-white">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <span className="text-lg font-bold text-navy">{companyName} Legacy Protection</span>
              <div className="flex gap-4 text-sm text-charcoal/60">
                <span>How It Works</span><span>Pricing</span><span>FAQ</span>
              </div>
            </div>
            <div className="bg-navy px-8 py-16 text-center">
              <h2 className="text-2xl font-bold text-white">Protect Your Family. It Takes 15 Minutes.</h2>
              <p className="mt-3 text-sm text-blue-100/70">Attorney-reviewed wills and trusts, built for Michigan.</p>
              <div className="mt-6 flex justify-center gap-3">
                <span className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white">Take the Free Quiz</span>
                <span className="rounded-full border border-white/50 px-6 py-2 text-sm text-white">Create a Will</span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white/5 border border-white/10 p-6">
            <span className="text-2xl">📧</span>
            <h3 className="mt-3 text-sm font-semibold text-white">Client Emails</h3>
            <p className="mt-1 text-xs text-blue-100/60">Your clients receive documents from {companyName}</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-6">
            <span className="text-2xl">📄</span>
            <h3 className="mt-3 text-sm font-semibold text-white">Documents</h3>
            <p className="mt-1 text-xs text-blue-100/60">All documents carry your brand and contact information</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-6">
            <span className="text-2xl">💰</span>
            <h3 className="mt-3 text-sm font-semibold text-white">Your Earnings</h3>
            <p className="mt-1 text-xs text-blue-100/60">Earn {willEarnings}/will &middot; {trustEarnings}/trust</p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <button onClick={() => router.push("/pro/onboarding/step-1")} className="inline-flex min-h-[44px] items-center rounded-full bg-gold px-10 py-3.5 text-base font-semibold text-white hover:bg-gold/90 transition-colors shadow-lg">
            Begin My Setup, 7 Steps
          </button>
          <div className="mt-4">
            <button onClick={() => router.push("/pro/dashboard")} className="text-sm text-blue-100/40 hover:text-blue-100/70 transition-colors">
              I&apos;ll set up later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
