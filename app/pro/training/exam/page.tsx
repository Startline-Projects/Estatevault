"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProTrainingExamPage() {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState("");
  const [certified, setCertified] = useState(false);
  const [passing, setPassing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase
        .from("partners")
        .select("id, certification_completed")
        .eq("profile_id", user.id)
        .single();

      if (partner) {
        setPartnerId(partner.id);
        setCertified(partner.certification_completed || false);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handlePassExam() {
    if (!partnerId) return;
    setPassing(true);

    const supabase = createClient();
    await supabase
      .from("partners")
      .update({ certification_completed: true })
      .eq("id", partnerId);

    setCertified(true);
    setPassing(false);
  }

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
          This exam covers all 4 training modules. In a future release, this will be a
          timed multiple-choice exam. For now, use the test button below.
        </p>

        <div className="mt-8 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-xs text-amber-700 font-medium">TEST MODE</p>
          <p className="mt-1 text-sm text-amber-800">
            Click the button below to simulate passing the certification exam.
          </p>
        </div>

        <button
          onClick={handlePassExam}
          disabled={passing}
          className="mt-6 rounded-full bg-gold px-8 py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {passing ? "Processing..." : "Pass Exam (Test Mode)"}
        </button>
      </div>
    </div>
  );
}
