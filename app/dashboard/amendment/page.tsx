"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SubscriptionBanner from "@/components/dashboard/SubscriptionBanner";
import { PRICES, formatPrice } from "@/lib/orders/pricing";
import { checkoutAmendment } from "@/lib/api-client/checkout";

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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
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
      const { data, error: err } = await checkoutAmendment({ userId, changeType, description });
      if (err || !data) { setError(err || "Something went wrong"); setLoading(false); return; }

      const result = data as Record<string, unknown>;
      // Free amendment for subscribers, redirect directly
      if (result.free) {
        router.push((result.url as string) || "/dashboard/documents?amended=true");
        return;
      }

      // Paid amendment, redirect to Stripe
      if ("url" in data) window.location.href = (data as { url: string }).url;
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
            : `Update your estate planning documents for ${formatPrice(PRICES.amendment)}.`
          }
        </p>
      </div>

      <SubscriptionBanner onStatusLoaded={(s) => setIsSubscriber(s.canAmendFree)} />

      <div className="rounded-xl bg-white border border-gray-200 p-6">
        <div>
          <label className="block text-sm font-medium text-navy mb-2">What would you like to change?</label>
          <select
            value={changeType}
            onChange={(e) => setChangeType(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, changeType: true }))}
            aria-invalid={touched.changeType && !changeType}
            aria-describedby={touched.changeType && !changeType ? "type-error" : undefined}
            className={`w-full min-h-[44px] rounded-xl border-2 px-4 py-3 text-sm focus:outline-none ${touched.changeType && !changeType ? "border-red-400 focus:border-red-400" : "border-gray-200 focus:border-gold"}`}
          >
            <option value="">Select a change type</option>
            {CHANGE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {touched.changeType && !changeType && <p id="type-error" role="alert" className="mt-1 text-xs text-red-600">Please select a change type.</p>}
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-navy mb-2">Describe what you&apos;d like to change</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, description: true }))}
            rows={5}
            maxLength={2000}
            placeholder="Please describe the changes you need..."
            aria-invalid={touched.description && !description.trim()}
            aria-describedby={touched.description && !description.trim() ? "desc-error" : undefined}
            className={`w-full rounded-xl border-2 px-4 py-3 text-sm focus:outline-none resize-none ${touched.description && !description.trim() ? "border-red-400 focus:border-red-400" : "border-gray-200 focus:border-gold"}`}
          />
          {touched.description && !description.trim() && <p id="desc-error" role="alert" className="mt-1 text-xs text-red-600">Please describe the changes you need.</p>}
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}

        <button onClick={handleSubmit} disabled={loading || !changeType || !description.trim()} className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading
            ? (isSubscriber ? "Submitting..." : "Redirecting to payment...")
            : (isSubscriber ? "Submit Amendment (Included with Subscription)" : `Proceed to Payment, ${formatPrice(PRICES.amendment)}`)
          }
        </button>
        {!isSubscriber && <p className="mt-2 text-center text-xs text-charcoal/60">Secure payment powered by Stripe</p>}
      </div>
    </div>
  );
}
