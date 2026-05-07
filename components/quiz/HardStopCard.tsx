"use client";

import Link from "next/link";
import { usePartnerBranding } from "@/components/partner/PartnerThemedShell";

export default function HardStopCard() {
  const branding = usePartnerBranding();
  const accent = branding?.accentColor || "#1C3557";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "var(--brand-900, #1C3557)" }}>
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `${accent}1f` }}>
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: accent }}>
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="mt-6 text-xl font-bold text-navy">
          Your family deserves specialized attention.
        </h2>
        <p className="mt-4 text-sm text-charcoal/70 leading-relaxed">
          Caring for a loved one with special needs requires a specialized trust
          that should be drafted by a licensed attorney. We&apos;ll connect you
          with an experienced Michigan estate planning attorney who can help.
        </p>
        <Link
          href="/attorney-referral"
          className="mt-8 inline-flex min-h-[44px] items-center rounded-full px-8 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: accent }}
        >
          Connect with an Attorney
        </Link>
      </div>
    </div>
  );
}
