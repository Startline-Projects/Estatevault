"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Step5Page() {
  const router = useRouter();
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase.from("partners").select("id, company_name, sender_name, sender_email").eq("profile_id", user.id).single();
      if (partner) {
        setPartnerId(partner.id);
        setCompanyName(partner.company_name || "");
        setSenderName(partner.sender_name || partner.company_name || "");
        setSenderEmail(partner.sender_email || "");
      }
    }
    load();
  }, []);

  function copyToClipboard(val: string, label: string) { navigator.clipboard.writeText(val); setCopied(label); setTimeout(() => setCopied(""), 2000); }

  async function handleContinue() {
    const supabase = createClient();
    await supabase.from("partners").update({ sender_name: senderName, sender_email: senderEmail, onboarding_step: 6 }).eq("id", partnerId);
    router.push("/pro/onboarding/step-6");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Set Up Your Email</h1>
      <p className="mt-1 text-sm text-charcoal/60">This is how your clients receive their documents.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Sender Name</label>
            <input type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            <p className="mt-1 text-xs text-charcoal/50">How your name appears in client inboxes</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Sender Email</label>
            <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="plans@yourcompany.com" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
          </div>
          <button disabled className="rounded-full border border-gray-300 px-5 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
            Send Test Email, available after launch
          </button>

          <div className="mt-6">
            <p className="text-sm font-semibold text-navy mb-3">DNS Records for Email</p>
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-navy uppercase tracking-wider">SPF Record</span>
                  <button
                    onClick={() => copyToClipboard("v=spf1 include:estatevault.us ~all", "spf")}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
                  >
                    {copied === "spf" ? "Copied!" : "Copy Value"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-charcoal/50 mb-0.5">Type</p><p className="font-medium text-charcoal">TXT</p></div>
                  <div><p className="text-xs text-charcoal/50 mb-0.5">Host</p><p className="font-mono text-charcoal">@</p></div>
                  <div><p className="text-xs text-charcoal/50 mb-0.5">Value</p><p className="font-mono text-charcoal text-xs break-all">v=spf1 include:estatevault.us ~all</p></div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-navy uppercase tracking-wider">DKIM Record</span>
                  <button
                    onClick={() => copyToClipboard("ev-dkim-placeholder", "dkim")}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
                  >
                    {copied === "dkim" ? "Copied!" : "Copy Value"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-charcoal/50 mb-0.5">Type</p><p className="font-medium text-charcoal">TXT</p></div>
                  <div><p className="text-xs text-charcoal/50 mb-0.5">Host</p><p className="font-mono text-charcoal text-xs">ev._domainkey</p></div>
                  <div><p className="text-xs text-charcoal/50 mb-0.5">Value</p><p className="font-mono text-charcoal text-xs break-all">ev-dkim-placeholder</p></div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2"><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">Pending</span><span className="text-xs text-charcoal/50">Email records not verified</span></div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <p className="text-sm font-semibold text-navy mb-3">Email Preview</p>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-navy">{senderName || companyName} <span className="font-normal text-charcoal/50">&lt;{senderEmail || "plans@yourcompany.com"}&gt;</span></p>
              <p className="text-xs text-charcoal/60 mt-0.5">Your Last Will & Testament is ready to review</p>
              <p className="text-xs text-charcoal/60 mt-0.5">2:34 PM</p>
            </div>
            <div className="p-4">
              <div className="h-8 w-20 bg-gray-100 rounded mb-4" />
              <div className="bg-navy rounded-t-lg px-4 py-2"><p className="text-xs text-white font-semibold">{companyName || "Company"}</p></div>
              <div className="bg-white border border-gray-100 p-4">
                <p className="text-xs text-charcoal/70">Dear [Client Name],</p>
                <p className="text-xs text-charcoal/70 mt-2">Your Will Package is ready to review and download.</p>
                <div className="mt-3"><span className="rounded-full bg-gold px-4 py-1 text-xs text-white font-semibold">Download Your Documents</span></div>
              </div>
              <div className="bg-gray-50 px-4 py-2 text-xs text-charcoal/60">{companyName} | Powered by EstateVault</div>
            </div>
          </div>
        </div>
      </div>

      <button onClick={handleContinue} className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">Continue</button>
    </div>
  );
}
