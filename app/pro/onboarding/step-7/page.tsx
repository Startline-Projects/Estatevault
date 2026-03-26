"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Step7Page() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase.from("partners").select("id, company_name").eq("profile_id", user.id).single();
      if (partner) { setPartnerId(partner.id); setCompanyName(partner.company_name || ""); }
    }
    load();
  }, []);

  async function handleGoToDashboard() {
    const supabase = createClient();
    await supabase.from("partners").update({ onboarding_completed: true }).eq("id", partnerId);
    router.push("/pro/dashboard");
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    const supabase = createClient();
    await supabase.from("waitlist_invites").insert({ partner_id: partnerId, client_email: inviteEmail });
    setInviteSent(true);
    setInviteEmail("");
    setTimeout(() => setInviteSent(false), 3000);
  }

  return (
    <div className="text-center">
      {/* Checkmark animation */}
      <div className="flex justify-center">
        <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <h1 className="mt-6 text-2xl font-bold text-navy">You&apos;re all set, {companyName}!</h1>
      <p className="mt-2 text-sm text-charcoal/60">Your EstateVault Pro platform is being configured. We&apos;ll send your launch email within 3 business days.</p>

      {/* Steps complete */}
      <div className="mt-8 flex justify-center gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((s) => (
          <div key={s} className="flex items-center gap-1">
            <span className="text-green-500 text-sm">✅</span>
            <span className="text-xs text-charcoal/50">Step {s}</span>
          </div>
        ))}
      </div>

      {/* Compliance readiness */}
      <div className="mt-8 rounded-xl bg-white border border-gray-200 p-6 text-left">
        <h3 className="text-base font-bold text-navy">Compliance Readiness</h3>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2"><span className="text-green-500">✅</span><span className="text-sm text-charcoal">Partner Agreement Signed</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-300">⬜</span><span className="text-sm text-charcoal/60">Certification Training — <span className="text-gold font-medium">Required to unlock client features</span></span></div>
          <div className="flex items-center gap-2"><span className="text-green-500">✅</span><span className="text-sm text-charcoal">Pricing Acknowledged</span></div>
        </div>
        <p className="mt-3 text-xs text-charcoal/50">You can explore your dashboard now, but client sessions are locked until you complete certification training.</p>
      </div>

      {/* Action cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        <div className="rounded-xl bg-white border border-gray-200 p-5 border-l-4 border-l-gold">
          <span className="text-xl">🎓</span>
          <h4 className="mt-2 text-sm font-bold text-navy">Complete Certification Training</h4>
          <p className="mt-1 text-xs text-charcoal/60">4 modules + exam. ~4.5 hours. Unlock your full platform immediately on passing.</p>
          <Link href="/pro/training" className="mt-3 inline-flex items-center rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold/90">Start Training →</Link>
        </div>
        <div className="rounded-xl bg-white border border-gray-200 p-5 border-l-4 border-l-navy">
          <span className="text-xl">📦</span>
          <h4 className="mt-2 text-sm font-bold text-navy">Download Marketing Toolkit</h4>
          <p className="mt-1 text-xs text-charcoal/60">Scripts, email templates, social posts, and print materials — all branded for you.</p>
          <button disabled className="mt-3 inline-flex items-center rounded-full bg-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-400 cursor-not-allowed">Requires Certification</button>
        </div>
        <div className="rounded-xl bg-white border border-gray-200 p-5 border-l-4 border-l-teal-500">
          <span className="text-xl">👤</span>
          <h4 className="mt-2 text-sm font-bold text-navy">Invite Your First Client</h4>
          <p className="mt-1 text-xs text-charcoal/60">Add a client now so they&apos;re ready when your platform goes live.</p>
          <div className="mt-3 flex gap-2">
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="client@email.com" className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-gold focus:outline-none" />
            <button onClick={handleInvite} className="rounded-full bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600">{inviteSent ? "Sent!" : "Invite"}</button>
          </div>
        </div>
      </div>

      {/* Dashboard preview */}
      <div className="mt-10 relative">
        <h3 className="text-base font-bold text-navy mb-4">Your dashboard is ready</h3>
        <div className="rounded-xl overflow-hidden border border-gray-200 opacity-50">
          <div className="bg-navy h-12 flex items-center px-4"><span className="text-sm text-white font-bold">EstateVault Pro</span></div>
          <div className="bg-gray-50 p-6 grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 h-24" /><div className="bg-white rounded-lg p-4 h-24" /><div className="bg-white rounded-lg p-4 h-24" />
            <div className="bg-white rounded-lg p-4 h-32 col-span-2" /><div className="bg-white rounded-lg p-4 h-32" />
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl bg-white/95 px-8 py-6 shadow-lg text-center">
            <p className="text-sm text-charcoal/60">🔒 Full access unlocks when your platform goes live and certification is complete</p>
          </div>
        </div>
      </div>

      <button onClick={handleGoToDashboard} className="mt-8 inline-flex min-h-[44px] items-center rounded-full bg-gold px-10 py-3.5 text-base font-semibold text-white hover:bg-gold/90 transition-colors shadow-lg">
        Go to My Dashboard →
      </button>
    </div>
  );
}
