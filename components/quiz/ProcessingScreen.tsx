"use client";

import { useEffect } from "react";
import { usePartnerBranding } from "@/components/partner/PartnerThemedShell";

interface ProcessingScreenProps {
  onComplete: () => void;
}

export default function ProcessingScreen({ onComplete }: ProcessingScreenProps) {
  const branding = usePartnerBranding();
  const accentVar = branding?.accentColor || "#C9A84C";

  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6" style={{ background: "var(--brand-900, #1C3557)" }}>
      <div className="animate-pulse">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl overflow-hidden" style={{ background: `${accentVar}33` }}>
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.companyName} className="h-16 w-16 object-contain" />
          ) : (
            <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: accentVar }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          )}
        </div>
      </div>

      <h2 className="mt-8 text-2xl font-bold text-white">
        Reviewing your answers...
      </h2>
      <p className="mt-3 text-sm text-white/60">
        Building your personalized recommendation
      </p>

      <div className="mt-10 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: accentVar,
              animation: "pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
