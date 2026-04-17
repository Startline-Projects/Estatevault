"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const stepMatch = pathname.match(/step-(\d)/);
  const currentStep = stepMatch ? parseInt(stepMatch[1]) : 1;
  const progress = (currentStep / 7) * 100;
  const isLastStep = currentStep === 7;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-6 py-4">
          <Link href="/pro/dashboard" className="text-lg font-bold text-navy">
            EstateVault <span className="text-gold">Pro</span>
          </Link>
          <span className="text-sm text-charcoal/60">Step {currentStep} of 7</span>
          <button onClick={() => { window.location.href = "/pro/dashboard"; }} className="text-sm text-navy/60 hover:text-navy transition-colors">
            Save & Exit
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-gold transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-24 px-6">
        <div className="mx-auto max-w-2xl">{children}</div>
      </div>

      {/* Bottom navigation, hidden on step 7 */}
      {!isLastStep && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-6 py-4">
          <div className="mx-auto max-w-2xl flex items-center justify-between">
            <button onClick={() => { if (currentStep > 1) router.push(`/pro/onboarding/step-${currentStep - 1}`); }} disabled={currentStep <= 1} className="rounded-full border border-gray-300 px-6 py-2.5 text-sm font-medium text-charcoal hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Back
            </button>
            <div />
          </div>
        </div>
      )}
    </div>
  );
}
