"use client";

import { useState } from "react";

export default function AffiliateOnboardingResume() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function resume() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/affiliate/onboarding", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.onboardingUrl) {
        throw new Error(data.error || "Failed to get onboarding link");
      }
      window.location.href = data.onboardingUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={resume}
        disabled={loading}
        className="bg-amber-900 hover:bg-amber-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        {loading ? "Loading..." : "Resume Stripe Setup →"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
