"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SubscriptionBanner from "@/components/dashboard/SubscriptionBanner";

const CHANGE_OPTIONS = [
  "Beneficiary",
  "Executor/Trustee",
  "Guardian",
  "Personal Information",
  "Add Assets",
  "Other",
];

export default function AmendmentPage() {
  const router = useRouter();
  const [changeType, setChangeType] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [isSubscriber, setIsSubscriber] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    init();
  }, []);

  async function handleSubmit() {
    if (!changeType || !description.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/checkout/amendment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, changeType, description }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return; }

      // Free amendment for subscribers — redirect directly
      if (data.free) {
        router.push(data.url || "/dashboard/documents?amended=true");
        return;
      }

      // Paid amendment — redirect to Stripe
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Request an Amendment</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          {isSubscriber
            ? "Amendments are included with your Vault subscription at no extra charge."
            : "Update your estate planning documents for $50."
          }
        </p>
      </div>

      <SubscriptionBanner onStatusLoaded={(s) => setIsSubscriber(s.canAmendFree)} />

      <div className="rounded-xl bg-white border border-gray-200 p-6">
        <div>
          <label className="block text-sm font-medium text-navy mb-2">What would you like to change?</label>
          <select value={changeType} onChange={(e) => setChangeType(e.target.value)} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none">
            <option value="">Select a change type</option>
            {CHANGE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-navy mb-2">Describe what you&apos;d like to change</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Please describe the changes you need..." className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none resize-none" />
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button onClick={handleSubmit} disabled={loading || !changeType || !description.trim()} className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading
            ? (isSubscriber ? "Submitting..." : "Redirecting to payment...")
            : (isSubscriber ? "Submit Amendment (Included with Subscription)" : "Proceed to Payment — $50")
          }
        </button>
        {!isSubscriber && <p className="mt-2 text-center text-xs text-charcoal/40">Secure payment powered by Stripe</p>}
      </div>
    </div>
  );
}
