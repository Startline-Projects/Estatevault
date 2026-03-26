"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Step4Page() {
  const router = useRouter();
  const [businessUrl, setBusinessUrl] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState("");
  const [provider, setProvider] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase.from("partners").select("id, business_url, company_name, partner_slug").eq("profile_id", user.id).single();
      if (partner) {
        setPartnerId(partner.id);
        setBusinessUrl(partner.business_url || "");
        setSlug(partner.partner_slug || partner.company_name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "");
      }
    }
    load();
  }, []);

  function copyToClipboard(val: string, label: string) {
    navigator.clipboard.writeText(val);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  }

  async function handleContinue() {
    const supabase = createClient();
    await supabase.from("partners").update({ subdomain: `legacy.${businessUrl}`, partner_slug: slug, onboarding_step: 5 }).eq("id", partnerId);
    router.push("/pro/onboarding/step-5");
  }

  const providerGuides: Record<string, string[]> = {
    GoDaddy: ["Log in to your GoDaddy account", "Go to DNS Management", "Add a new CNAME record", "Set Host to 'legacy' and Value to cname.estatevault.com", "Save changes — may take up to 48 hours"],
    Namecheap: ["Log in to Namecheap", "Go to Domain List → Manage → Advanced DNS", "Add a CNAME record", "Host: legacy, Value: cname.estatevault.com", "Save — propagation may take up to 48 hours"],
    Cloudflare: ["Log in to Cloudflare", "Select your domain → DNS", "Add CNAME record: Name: legacy, Target: cname.estatevault.com", "Set proxy status to DNS only", "Save"],
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Set Up Your Domain</h1>
      <p className="mt-1 text-sm text-charcoal/60">This is the URL your clients will visit.</p>

      <div className="mt-8 rounded-xl bg-gray-800 p-4 flex items-center">
        <div className="flex gap-1.5 mr-4"><div className="h-3 w-3 rounded-full bg-red-400" /><div className="h-3 w-3 rounded-full bg-yellow-400" /><div className="h-3 w-3 rounded-full bg-green-400" /></div>
        <div className="flex-1 bg-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-300">legacy.{businessUrl || "yourcompany.com"}</div>
      </div>

      <p className="mt-4 text-sm text-charcoal/60">To activate your URL, add these records to your domain provider:</p>

      <div className="mt-4 rounded-xl bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="text-left px-4 py-3 text-xs font-semibold text-navy">Type</th><th className="text-left px-4 py-3 text-xs font-semibold text-navy">Host</th><th className="text-left px-4 py-3 text-xs font-semibold text-navy">Value</th><th className="px-4 py-3"></th></tr></thead>
          <tbody>
            <tr className="border-t border-gray-100">
              <td className="px-4 py-3 text-charcoal/70">CNAME</td>
              <td className="px-4 py-3 font-mono text-charcoal">legacy</td>
              <td className="px-4 py-3 font-mono text-charcoal text-xs">cname.estatevault.com</td>
              <td className="px-4 py-3"><button onClick={() => copyToClipboard("cname.estatevault.com", "cname")} className="text-xs text-gold hover:text-gold/80">{copied === "cname" ? "Copied!" : "Copy"}</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-navy mb-1">Which domain provider do you use?</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none">
          <option value="">Select provider</option>
          {["GoDaddy", "Namecheap", "Cloudflare", "Google Domains", "Squarespace", "Other"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {provider && providerGuides[provider] && (
          <div className="mt-3 rounded-lg bg-gray-50 p-4">
            <ol className="space-y-1 text-sm text-charcoal/70">
              {providerGuides[provider].map((step, i) => <li key={i}>{i + 1}. {step}</li>)}
            </ol>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">⏳ Pending</span>
        <span className="text-sm text-charcoal/50">DNS records not yet detected</span>
      </div>

      <div className="mt-4 rounded-lg bg-gray-50 p-4">
        <p className="text-xs text-charcoal/50">Until your custom domain is set up, your platform is accessible at:</p>
        <p className="mt-1 text-sm font-mono text-navy">estatevault.com/{slug || "your-company"}</p>
      </div>

      <button onClick={handleContinue} className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">Continue</button>
    </div>
  );
}
