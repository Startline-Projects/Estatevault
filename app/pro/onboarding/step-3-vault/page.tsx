"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Step3VaultPage() {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState("");
  const [subdomainInput, setSubdomainInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<"idle" | "available" | "taken" | "invalid">("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/pro/login"); return; }
      const { data: partner } = await supabase
        .from("partners")
        .select("id, tier, company_name, onboarding_step, vault_subdomain")
        .eq("profile_id", user.id)
        .single();
      if (!partner || partner.tier !== "basic") { router.push("/pro/dashboard"); return; }
      if (partner.onboarding_step < 3) { router.push("/pro/onboarding/step-2-vault"); return; }
      if (partner.vault_subdomain) { router.push("/pro/dashboard"); return; }
      setPartnerId(partner.id);
      // Pre-fill from company name
      if (partner.company_name) {
        const slug = partner.company_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        setSubdomainInput(slug);
      }
    }
    load();
  }, [router]);

  const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,50}[a-z0-9]$/;

  function sanitize(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+/, "");
  }

  async function checkAvailability(value: string) {
    if (!value || !SUBDOMAIN_REGEX.test(value)) {
      setAvailability(value ? "invalid" : "idle");
      return;
    }
    setChecking(true);
    setAvailability("idle");
    try {
      const res = await fetch(`/api/partner/vault-subdomain?subdomain=${encodeURIComponent(value)}`);
      const data = await res.json();
      setAvailability(data.available ? "available" : "taken");
    } catch {
      setAvailability("idle");
    } finally {
      setChecking(false);
    }
  }

  function handleChange(val: string) {
    const clean = sanitize(val);
    setSubdomainInput(clean);
    setAvailability("idle");
  }

  async function handleClaim() {
    if (availability !== "available") return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/partner/vault-subdomain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, subdomain: subdomainInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to claim subdomain");
      window.location.href = "/pro/onboarding/step-4-vault";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const statusColors: Record<string, string> = {
    available: "text-green-600",
    taken: "text-red-600",
    invalid: "text-amber-600",
    idle: "text-gray-400",
    checking: "text-gray-400",
  };

  const statusMessages: Record<string, string> = {
    available: `✓ ${subdomainInput}.estatevault.us is available`,
    taken: `✗ ${subdomainInput}.estatevault.us is taken`,
    invalid: "Use only lowercase letters, numbers, and hyphens (min 3 chars)",
    idle: "",
  };

  return (
    <div className="max-w-xl">
      <div className="mb-2 text-xs font-semibold text-gold uppercase tracking-wider">Step 3 of 3</div>
      <h1 className="text-2xl font-bold text-navy">Choose Your Subdomain</h1>
      <p className="mt-1 text-sm text-charcoal/60">Your clients will access your white-label vault at this URL.</p>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Subdomain</label>
          <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-gold/40 focus-within:border-gold">
            <input
              value={subdomainInput}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={() => checkAvailability(subdomainInput)}
              className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white"
              placeholder="yourcompany"
              maxLength={52}
            />
            <span className="bg-gray-50 border-l border-gray-200 px-3 py-2 text-sm text-gray-400 whitespace-nowrap select-none">
              .estatevault.us
            </span>
          </div>
          <p className={`text-xs mt-2 min-h-[16px] ${checking ? statusColors.checking : statusColors[availability]}`}>
            {checking ? "Checking availability..." : statusMessages[availability]}
          </p>
        </div>

        {/* Preview */}
        <div className="rounded-lg bg-navy/5 border border-navy/10 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Your vault URL</p>
          <p className="text-sm font-mono text-navy font-medium">
            https://{subdomainInput || "yourcompany"}.estatevault.us
          </p>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p>• Lowercase letters, numbers, hyphens only</p>
          <p>• Cannot be changed later without contacting support</p>
          <p>• Share this link with your clients to sign up for the vault</p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => checkAvailability(subdomainInput)}
          disabled={checking || !subdomainInput}
          className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          {checking ? "Checking..." : "Check Availability"}
        </button>
        <button
          onClick={handleClaim}
          disabled={availability !== "available" || saving}
          className="flex-1 py-3 rounded-xl bg-gold text-white font-semibold text-sm hover:bg-gold/90 disabled:opacity-50 transition"
        >
          {saving ? "Claiming..." : "Claim & Finish Setup →"}
        </button>
      </div>
    </div>
  );
}
