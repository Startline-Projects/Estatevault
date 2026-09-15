"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api-client/partner";

export default function ProTrainingExamPage() {
  const router = useRouter();
  const [certified, setCertified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await getMe();
      if (data?.partner) setCertified(data.partner.certification_completed || false);
      setLoading(false);
    }
    load();
  }, []);


  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (certified) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="h-10 w-10 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-navy">Certification Complete!</h1>
        <p className="mt-2 text-sm text-charcoal/60">
          You have passed the EstateVault Partner Certification Exam. Your platform is now
          fully unlocked.
        </p>
        <button
          onClick={() => router.push("/pro/dashboard")}
          className="mt-6 rounded-full bg-gold px-8 py-3 text-sm font-semibold text-white hover:bg-gold/90"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/pro/training")}
        className="text-sm text-charcoal/50 hover:text-navy mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Training
      </button>

      <div className="rounded-xl bg-white border border-gray-200 p-8 text-center">
        <span className="text-4xl">🎓</span>
        <h1 className="mt-4 text-2xl font-bold text-navy">Certification Exam</h1>
        <p className="mt-2 text-sm text-charcoal/60 max-w-md mx-auto">
          This exam covers all 4 training modules. It is not available yet.
          EstateVault confirms your certification once you have completed the
          training with your account manager.
        </p>

        <div className="mt-8 rounded-xl bg-navy/5 border border-navy/10 p-4">
          <p className="text-sm text-charcoal/70">
            Certification is confirmed by EstateVault once you have completed the
            training with your account manager.
          </p>
        </div>
      </div>
    </div>
  );
}
