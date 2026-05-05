"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeBusinessDomain } from "@/lib/hosts";

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming",
];

const PROFESSIONAL_TYPES = [
  "Financial Advisor",
  "CPA/Accountant",
  "Insurance Agent",
  "Attorney",
  "Other",
];

const PLAN_TIERS: { label: string; value: string; price: string; description: string }[] = [
  { label: "Basic", value: "basic", price: "$500 one-time", description: "White-label vault only" },
  { label: "Standard", value: "standard", price: "$1,200 one-time", description: "Full estate planning platform" },
  { label: "Enterprise", value: "enterprise", price: "$6,000 one-time", description: "Full platform + custom domain" },
];

// Fixed revenue splits by tier (non-basic locked per CLAUDE.md pricing rules).
const TIER_FIXED_REVENUE_PCT: Record<string, number> = {
  standard: 75,    // $300 of $400 will / $400 of $600 trust
  enterprise: 87,  // $350 of $400 will / $450 of $600 trust
};

const LEAD_SOURCES = [
  "Cold Outreach",
  "Referral",
  "Conference",
  "Existing Relationship",
  "Inbound Lead",
  "Other",
];

interface FormData {
  companyName: string;
  ownerName: string;
  email: string;
  businessUrl: string;
  phone: string;
  state: string;
  professionalType: string;
  planTier: string;
  leadSource: string;
  notes: string;
  partnerRevenuePct: number;
}

const initialForm: FormData = {
  companyName: "",
  ownerName: "",
  email: "",
  businessUrl: "",
  phone: "",
  state: "Michigan",
  professionalType: "",
  planTier: "",
  leadSource: "",
  notes: "",
  partnerRevenuePct: 10,
};

interface SuccessData {
  email: string;
  tempPassword: string;
}

export default function NewPartnerPage() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [copied, setCopied] = useState(false);

  function set(field: keyof FormData, value: string | number) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "planTier") {
        const tier = String(value);
        if (tier in TIER_FIXED_REVENUE_PCT) {
          next.partnerRevenuePct = TIER_FIXED_REVENUE_PCT[tier];
        } else if (tier === "basic") {
          next.partnerRevenuePct = 10;
        }
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!form.companyName || !form.ownerName || !form.email) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/sales/create-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          ownerName: form.ownerName,
          email: form.email,
          businessUrl: form.businessUrl,
          phone: form.phone,
          state: form.state,
          professionalType: form.professionalType,
          tier: form.planTier,
          source: form.leadSource,
          notes: form.notes,
          partnerRevenuePct: form.partnerRevenuePct,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create partner");
      setSuccess({ email: data.email || form.email, tempPassword: data.tempPassword || "TempPass-2024!" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSendWelcome() {
    try {
      const res = await fetch("/api/sales/send-welcome-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: success?.email,
          tempPassword: success?.tempPassword,
          ownerName: form.ownerName,
          companyName: form.companyName,
        }),
      });
      if (res.ok) {
        alert("Welcome email sent to " + success?.email);
      } else {
        const data = await res.json();
        alert("Failed to send email: " + (data.error || "Unknown error"));
      }
    } catch {
      alert("Something went wrong sending the email.");
    }
  }

  /* ---------- live preview helpers ---------- */
  const strippedUrl = normalizeBusinessDomain(form.businessUrl);
  const previewUrl = form.planTier === "basic"
    ? (strippedUrl ? `${strippedUrl.replace(/\./g, "-")}.estatevault.us` : "yourcompany.estatevault.us")
    : (strippedUrl ? `legacy.${strippedUrl}` : "legacy.yoursite.com");
  const hasSomething = form.companyName || form.ownerName || form.email;

  /* =========================================== */
  /*                SUCCESS STATE                */
  /* =========================================== */
  if (success) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-charcoal mb-2">Partner Account Created</h1>
        <p className="text-gray-500 mb-8">The new partner account is ready to go.</p>

        <div className="bg-white rounded-xl border border-gray-200 p-6 text-left space-y-4 mb-8">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Email</p>
            <p className="font-medium text-charcoal">{success.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Temporary Password</p>
            <div className="flex items-center gap-2">
              <code className="bg-gray-100 px-3 py-1.5 rounded text-sm font-mono flex-1">{success.tempPassword}</code>
              <button
                onClick={() => handleCopy(success.tempPassword)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 transition"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleSendWelcome}
            className="px-5 py-2.5 rounded-lg bg-navy text-white text-sm font-medium hover:bg-navy/90 transition"
          >
            Send Welcome Email
          </button>
          <a
            href="/pro/preview"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-lg bg-gold text-white text-sm font-medium hover:bg-gold-600 transition text-center"
          >
            Open Their Preview
          </a>
          <button
            onClick={() => { setSuccess(null); setForm(initialForm); }}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  /* =========================================== */
  /*                MAIN FORM                    */
  /* =========================================== */
  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-1">Create New Partner</h1>
      <p className="text-gray-500 text-sm mb-8">Set up a new professional partner account and preview their white-label site.</p>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ---- LEFT COLUMN: Form (55%) ---- */}
        <div className="lg:w-[55%] space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Company & Owner */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Business Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
                <input
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                  placeholder="Acme Financial Group"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Owner Name *</label>
                <input
                  value={form.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                  placeholder="Jane Smith"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                  placeholder="jane@acmefinancial.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Business URL</label>
                <input
                  value={form.businessUrl}
                  onChange={(e) => set("businessUrl", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                  placeholder="acmefinancial.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                <select
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                >
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Professional Type */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Professional Type</h2>
            <div className="flex flex-wrap gap-2">
              {PROFESSIONAL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("professionalType", t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    form.professionalType === t
                      ? "border-gold bg-gold/10 text-navy"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Plan Tier */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Plan Tier</h2>
            <div className="grid grid-cols-3 gap-3">
              {PLAN_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  type="button"
                  onClick={() => set("planTier", tier.value)}
                  className={`rounded-xl border-2 p-4 text-left transition ${
                    form.planTier === tier.value
                      ? "border-gold bg-gold/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-charcoal">{tier.label}</p>
                  <p className="text-sm text-gold font-medium mt-0.5">{tier.price}</p>
                  <p className="text-xs text-gray-400 mt-1">{tier.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Lead Source + Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">Additional Details</h2>
            {form.planTier === "basic" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Partner Revenue %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.partnerRevenuePct}
                  onChange={(e) => set("partnerRevenuePct", Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                />
                <p className="mt-1 text-xs text-gray-400">Percentage of vault subscription revenue ($99/yr) sent directly to partner via Stripe.</p>
              </div>
            )}
            {form.planTier in TIER_FIXED_REVENUE_PCT && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Partner Revenue %</label>
                <div className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-charcoal">
                  {TIER_FIXED_REVENUE_PCT[form.planTier]}% (fixed for {form.planTier} tier)
                </div>
                <p className="mt-1 text-xs text-gray-400">Standard and Enterprise tiers use fixed revenue splits per platform pricing rules.</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lead Source</label>
              <select
                value={form.leadSource}
                onChange={(e) => set("leadSource", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
              >
                <option value="">Select a source...</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold resize-none"
                placeholder="Anything relevant about this partner..."
              />
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gold text-white font-semibold text-sm hover:bg-gold-600 transition disabled:opacity-50"
          >
            {submitting ? "Creating Account..." : "Generate Preview & Create Account"}
          </button>
        </div>

        {/* ---- RIGHT COLUMN: Live Preview (45%) ---- */}
        <div className="lg:w-[45%]">
          <div className="sticky top-8 space-y-6">
            {/* Browser Mockup */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">White-Label Preview</h3>
              {hasSomething ? (
                <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
                  {/* Browser chrome */}
                  <div className="bg-gray-100 border-b border-gray-200 px-3 py-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <div className="bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 truncate">
                      https://{previewUrl}
                    </div>
                  </div>

                  {/* Simulated landing page */}
                  <div>
                    {/* Header */}
                    <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-sm font-bold text-navy">
                        {form.companyName || "Company Name"}
                      </span>
                      <span className="text-[10px] text-gray-400">Powered by EstateVault</span>
                    </div>
                    {/* Hero */}
                    <div className="bg-navy px-6 py-10 text-center">
                      <h2 className="text-white text-lg font-bold mb-2">
                        Protect What Matters Most
                      </h2>
                      <p className="text-white/70 text-xs mb-5 max-w-xs mx-auto">
                        {form.companyName
                          ? `${form.companyName} has partnered with EstateVault to bring you simple, affordable estate planning.`
                          : "Your trusted partner for simple, affordable estate planning."}
                      </p>
                      <div className="inline-block bg-gold text-white text-xs font-semibold rounded-lg px-5 py-2">
                        Get Started
                      </div>
                    </div>
                    {/* Features mini */}
                    <div className="grid grid-cols-3 gap-2 p-4">
                      {(form.planTier === "basic"
                        ? ["Secure Vault", "Trustees", "Farewell Video"]
                        : ["Will Package", "Trust Package", "Secure Vault"]
                      ).map((f) => (
                        <div key={f} className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-[10px] font-medium text-charcoal">{f}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center h-64">
                  <p className="text-sm text-gray-400 text-center px-6">
                    Fill in the details to see a live preview.
                  </p>
                </div>
              )}
            </div>

            {/* Email Preview */}
            {hasSomething && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Welcome Email Preview</h3>
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-white text-xs font-bold">
                      {(form.ownerName || "?")[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">
                        EstateVault for {form.companyName || "Partner"}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        to: {form.email || "partner@example.com"}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-2">
                    <p className="text-xs font-semibold text-charcoal">
                      Subject: Welcome to EstateVault, {form.ownerName ? form.ownerName.split(" ")[0] : "Partner"}!
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Your white-label estate planning portal is ready at{" "}
                      <span className="text-gold font-medium">{previewUrl}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* URL Preview */}
            {hasSomething && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Partner URL</h3>
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <p className="text-sm font-mono text-navy">https://{previewUrl}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
