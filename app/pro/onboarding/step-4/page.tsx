"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Step4Page() {
  const router = useRouter();
  const [businessUrl, setBusinessUrl] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [slug, setSlug] = useState("");
  const [tier, setTier] = useState("");
  const [copied, setCopied] = useState("");
  const [provider, setProvider] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "verified" | "pending" | "wrong">("idle");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [savedDomain, setSavedDomain] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase
        .from("partners")
        .select("id, business_url, company_name, partner_slug, tier, subdomain, domain_verified")
        .eq("profile_id", user.id)
        .single();
      if (partner) {
        setPartnerId(partner.id);
        setTier(partner.tier || "standard");
        setSlug(
          partner.partner_slug ||
          partner.company_name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
          ""
        );
        if (partner.business_url) {
          const clean = partner.business_url.replace(/^https?:\/\//, "").replace(/\/$/, "");
          setBusinessUrl(clean);
        }
        if (partner.subdomain) {
          setSavedDomain(partner.subdomain);
          if (partner.domain_verified) setVerifyStatus("verified");
        }
      }
    }
    load();
  }, []);

  function copyToClipboard(val: string, label: string) {
    navigator.clipboard.writeText(val);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  }

  const cleanUrl = businessUrl.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();

  async function handleSaveDomain() {
    if (!cleanUrl) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/partner/add-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessUrl: cleanUrl, domainType: "subdomain" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to register domain. Please try again.");
        setSaving(false);
        return;
      }

      setSavedDomain(data.domain);
      setVerifyStatus("idle");

      // Also save business_url and slug
      const supabase = createClient();
      await supabase
        .from("partners")
        .update({ business_url: cleanUrl, partner_slug: slug, onboarding_step: 5 })
        .eq("id", partnerId);

    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSaving(false);
  }

  async function handleVerifyDomain() {
    if (!savedDomain) return;
    setVerifying(true);
    setVerifyMessage("");

    try {
      const res = await fetch(`/api/partner/verify-domain?domain=${savedDomain}`);
      const data = await res.json();

      if (data.verified) {
        setVerifyStatus("verified");
        setVerifyMessage("Your domain is verified and live!");
      } else if (data.records?.length > 0) {
        setVerifyStatus("wrong");
        setVerifyMessage(data.message || "CNAME found but points to the wrong destination.");
      } else {
        setVerifyStatus("pending");
        setVerifyMessage(data.message || "No CNAME record found yet. DNS can take up to 48 hours.");
      }
    } catch {
      setVerifyMessage("DNS check failed. Please try again.");
    }
    setVerifying(false);
  }

  async function handleContinue() {
    const supabase = createClient();
    await supabase
      .from("partners")
      .update({ partner_slug: slug, onboarding_step: 5 })
      .eq("id", partnerId);
    router.push("/pro/onboarding/step-5");
  }

  const providerGuides: Record<string, string[]> = {
    GoDaddy: [
      "Log in to GoDaddy → My Products → DNS",
      "Click Add under DNS Records",
      'Type: CNAME, Name: legacy, Value: cname.estatevault.us',
      "TTL: 1 Hour → Save",
    ],
    Namecheap: [
      "Log in → Domain List → Manage → Advanced DNS",
      "Add New Record → CNAME Record",
      'Host: legacy, Value: cname.estatevault.us',
      "Save All Changes",
    ],
    Cloudflare: [
      "Log in → select domain → DNS → Records → Add Record",
      'Type: CNAME, Name: legacy, Target: cname.estatevault.us',
      "Proxy status: DNS only (grey cloud, NOT orange)",
      "Save",
    ],
    "Google Domains": [
      "Log in → select domain → DNS → Manage custom records",
      'Host name: legacy, Type: CNAME, Data: cname.estatevault.us',
      "Save",
    ],
    Squarespace: [
      "Domains → click domain → DNS Settings → Add Record",
      'Type: CNAME, Host: legacy, Data: cname.estatevault.us',
      "Save",
    ],
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Set Up Your Domain</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Your clients will access your branded estate planning site at this URL.
      </p>

      {/* Domain preview */}
      <div className="mt-8 rounded-xl bg-gray-800 p-4 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-400" />
          <div className="h-3 w-3 rounded-full bg-yellow-400" />
          <div className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-200 font-mono">
          https://legacy.{cleanUrl || "yourcompany.com"}
        </div>
      </div>

      {/* Business domain input */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-navy mb-1">
          Your Business Domain
        </label>
        <p className="text-xs text-charcoal/50 mb-2">
          Enter the domain you own (e.g., <span className="font-mono">thepeoplesfirm.com</span>). Do not include www or https.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={businessUrl}
            onChange={(e) => setBusinessUrl(e.target.value.replace(/^https?:\/\//, "").replace(/\/$/, ""))}
            placeholder="yourcompany.com"
            className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none font-mono"
          />
          <button
            onClick={handleSaveDomain}
            disabled={saving || !cleanUrl}
            className="px-6 py-3 rounded-xl bg-navy text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : savedDomain ? "Update" : "Save"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* DNS instructions, shown after domain is saved */}
      {savedDomain && (
        <>
          <div className="mt-8">
            <h2 className="text-base font-semibold text-navy mb-1">Add This DNS Record</h2>
            <p className="text-sm text-charcoal/60 mb-3">
              Log in to your domain registrar and add the following CNAME record:
            </p>
            <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Host / Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Value / Target</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-3 text-charcoal/70 font-mono">CNAME</td>
                    <td className="px-4 py-3 font-mono text-charcoal font-semibold">legacy</td>
                    <td className="px-4 py-3 font-mono text-charcoal text-xs">cname.estatevault.us</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => copyToClipboard("cname.estatevault.us", "cname")}
                        className="text-xs text-gold hover:text-gold/80"
                      >
                        {copied === "cname" ? "Copied!" : "Copy"}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Provider-specific guides */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-navy mb-2">
              Step-by-step for your provider:
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(providerGuides).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(provider === p ? "" : p)}
                  className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                    provider === p
                      ? "border-gold bg-gold/10 text-navy"
                      : "border-gray-200 text-charcoal/70 hover:border-gold/40"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {provider && providerGuides[provider] && (
              <div className="mt-3 rounded-lg bg-gray-50 p-4">
                <ol className="space-y-1.5 text-sm text-charcoal/70">
                  {providerGuides[provider].map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-semibold text-navy shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Verification status */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">DNS Status</p>
                <p className="text-xs text-charcoal/50 mt-0.5 font-mono">{savedDomain}</p>
              </div>
              <div className="flex items-center gap-3">
                {verifyStatus === "verified" && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    ✓ Verified & Live
                  </span>
                )}
                {verifyStatus === "pending" && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    ⏳ Propagating
                  </span>
                )}
                {verifyStatus === "wrong" && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                    ✗ Wrong Target
                  </span>
                )}
                {verifyStatus === "idle" && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                    Not checked
                  </span>
                )}
                <button
                  onClick={handleVerifyDomain}
                  disabled={verifying}
                  className="px-4 py-2 rounded-lg bg-navy text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-50 transition-colors"
                >
                  {verifying ? "Checking..." : "Check DNS"}
                </button>
              </div>
            </div>
            {verifyMessage && (
              <p className={`mt-3 text-xs ${verifyStatus === "verified" ? "text-green-700" : "text-charcoal/60"}`}>
                {verifyMessage}
              </p>
            )}
          </div>
        </>
      )}

      {/* Fallback URL notice */}
      <div className="mt-6 rounded-lg bg-gray-50 border border-gray-200 p-4">
        <p className="text-xs text-charcoal/50 font-medium">Available immediately, no DNS setup needed:</p>
        <p className="mt-1 text-sm font-mono text-navy">
          estatevault.us/{slug || "your-company"}
        </p>
        <p className="text-xs text-charcoal/40 mt-1">
          Use this URL while your custom domain propagates.
        </p>
      </div>

      {tier === "enterprise" && (
        <div className="mt-4 rounded-lg bg-navy/5 border border-navy/10 p-4">
          <p className="text-xs font-semibold text-navy">Enterprise: Custom Domain</p>
          <p className="text-xs text-charcoal/60 mt-1">
            As an Enterprise partner you can use any domain or subdomain (e.g. <span className="font-mono">www.yourfirm.com</span>).
            Contact your account manager to configure a custom domain.
          </p>
        </div>
      )}

      <button
        onClick={handleContinue}
        className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
