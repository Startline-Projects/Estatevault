"use client";

import { useState } from "react";
import { usePartnerBranding } from "@/components/partner/PartnerThemedShell";
import { recordHardStopReferral } from "@/lib/api-client/referrals";

interface HardStopCardProps {
  // When present, the card collects the lead's contact details and logs an
  // attorney referral attributed to this partner (the $75 fee). Omit on the
  // generic marketing quiz where there's no partner to attribute.
  partnerId?: string;
  reason?: string;
}

export default function HardStopCard({ partnerId, reason }: HardStopCardProps) {
  const branding = usePartnerBranding();
  const accent = branding?.accentColor || "#1C3557";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = name.trim().length > 0 && emailValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    const { error: apiErr } = await recordHardStopReferral({
      partnerId: partnerId || undefined,
      reason: reason || "Attorney referral",
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
    });
    setSubmitting(false);
    if (apiErr) {
      setError("Something went wrong. Please email attorneys@estatevault.us.");
      return;
    }
    setSubmitted(true);
  }

  const cardWrap = (
    children: React.ReactNode,
  ) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "var(--brand-900, #1C3557)" }}>
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `${accent}1f` }}>
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: accent }}>
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        {children}
      </div>
    </div>
  );

  // Submitted confirmation.
  if (submitted) {
    return cardWrap(
      <>
        <h2 className="mt-6 text-xl font-bold text-navy">We&apos;ve received your request.</h2>
        <p className="mt-4 text-sm text-charcoal/70 leading-relaxed">
          A licensed Michigan estate planning attorney will reach out to you soon. You can also
          contact us directly at{" "}
          <a href="mailto:attorneys@estatevault.us" className="font-medium" style={{ color: accent }}>
            attorneys@estatevault.us
          </a>
          .
        </p>
      </>,
    );
  }

  // Collect contact so the partner/attorney can follow up. Shown for both the
  // partner-attributed flow and EstateVault's own direct site.
  return cardWrap(
    <>
      <h2 className="mt-6 text-xl font-bold text-navy">Your family deserves specialized attention.</h2>
      <p className="mt-3 text-sm text-charcoal/70 leading-relaxed">
        Caring for a loved one with special needs requires a specialized trust that should be drafted
        by a licensed attorney. Share your details and an experienced Michigan attorney will reach
        out.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
        <div>
          <label className="block text-xs font-medium text-charcoal/60 mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ ["--tw-ring-color" as string]: `${accent}66` }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-charcoal/60 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ ["--tw-ring-color" as string]: `${accent}66` }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-charcoal/60 mb-1">Phone <span className="text-charcoal/40">(optional)</span></label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ ["--tw-ring-color" as string]: `${accent}66` }}
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full min-h-[44px] rounded-full px-8 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: accent }}
        >
          {submitting ? "Sending…" : "Connect with an Attorney"}
        </button>
      </form>
    </>,
  );
}
