"use client";

import { useState } from "react";
import Link from "next/link";
import { usePartnerBranding } from "@/components/partner/PartnerThemedShell";

interface AcknowledgmentCardProps {
  onContinue: () => void;
}

export default function AcknowledgmentCard({ onContinue }: AcknowledgmentCardProps) {
  const [checked, setChecked] = useState(false);
  const branding = usePartnerBranding();

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        {/* <Link href={branding ? `/?partner=${branding.id}` : "/"} className="mb-8 flex justify-center">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.companyName} className="h-12 w-auto object-contain" />
          ) : (
            <span className="text-2xl font-bold text-white">{branding?.companyName || "EstateVault"}</span>
          )}
        </Link> */}

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="text-xl font-bold text-navy">Before We Begin</h1>

          <div className="mt-6 space-y-4 text-sm text-charcoal/70 leading-relaxed">
            <p>
              This platform provides document preparation services only. It does
              not provide legal advice. No attorney-client relationship is
              created by your use of this platform.
            </p>
            <p>
              The documents generated are based solely on the information you
              provide. You are responsible for ensuring all information is
              accurate and complete. You are responsible for properly executing
              your documents in accordance with Michigan law requirements.
            </p>
            <p>
              If your situation is complex, we recommend consulting a licensed
              Michigan estate planning attorney.
            </p>
          </div>

          <label className="mt-8 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-gray-300 accent-gold"
            />
            <span className="text-sm text-charcoal leading-relaxed">
              I understand and agree that this is a document preparation service,
              not legal advice, and no attorney-client relationship is created.
            </span>
          </label>

          <button
            onClick={() => { if (checked) onContinue(); }}
            disabled={!checked}
            className={`mt-6 w-full min-h-[44px] rounded-full py-3.5 text-sm font-semibold transition-all ${
              checked
                ? "bg-gold text-white hover:bg-gold/90 shadow-md"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            I Understand, Continue
          </button>
        </div>
      </div>
    </div>
  );
}
