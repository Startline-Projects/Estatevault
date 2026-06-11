"use client";

import { useState, useEffect } from "react";
import { PRICES, formatPrice } from "@/lib/orders/pricing";
import { getStatus, cancel as cancelSubscription } from "@/lib/api-client/subscription";
import { checkoutVaultSubscription } from "@/lib/api-client/checkout";

interface SubscriptionStatus {
  status: string;
  expiry: string | null;
  canAmendFree: boolean;
  canUseFarewell: boolean;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number | null;
}

type StatusInput = {
  status: string;
  expiry?: string | null;
  canAmendFree?: boolean;
  canUseFarewell?: boolean;
  cancelAtPeriodEnd?: boolean;
  daysRemaining?: number | null;
};

function normalize(s: StatusInput): SubscriptionStatus {
  const active = s.status === "active";
  return {
    status: s.status,
    expiry: s.expiry ?? null,
    canAmendFree: s.canAmendFree ?? active,
    canUseFarewell: s.canUseFarewell ?? active,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd ?? false,
    daysRemaining: s.daysRemaining ?? null,
  };
}

export default function SubscriptionBanner({ onStatusLoaded, status: statusProp }: { onStatusLoaded?: (status: SubscriptionStatus) => void; status?: StatusInput | null }) {
  // When the `status` prop is present (even null), the parent owns the fetch — defer to it
  // and never make our own request. When omitted (undefined), fetch standalone.
  const managed = statusProp !== undefined;
  const [sub, setSub] = useState<SubscriptionStatus | null>(statusProp ? normalize(statusProp) : null);
  const [loading, setLoading] = useState(!managed);
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (managed) {
      if (statusProp) {
        const status = normalize(statusProp);
        setSub(status);
        onStatusLoaded?.(status);
      }
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const { data } = await getStatus();
        if (data) {
          const status = data as unknown as SubscriptionStatus;
          setSub(status);
          onStatusLoaded?.(status);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [onStatusLoaded, statusProp, managed]);

  async function handleSubscribe() {
    setSubscribing(true);
    try {
      const { data } = await checkoutVaultSubscription();
      if (data?.url) window.location.href = data.url;
    } catch { /* ignore */ }
    setSubscribing(false);
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const { error } = await cancelSubscription();
      if (!error) {
        // Reload so the banner reflects the new cancelled-with-access state and
        // the rest of the page picks up the updated status.
        window.location.reload();
        return;
      }
    } catch { /* ignore */ }
    setCancelling(false);
    setConfirmCancel(false);
  }

  if (loading || !sub) return null;

  if (sub.status === "active") {
    const expiryDate = sub.expiry ? new Date(sub.expiry).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-green-600 text-white">Active</span>
            <div>
              <p className="text-sm font-semibold text-green-800">Vault Subscription</p>
              {expiryDate && <p className="text-xs text-green-600">Renews {expiryDate}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-700">
            <span>Free amendments</span>
            <span className="text-green-400">|</span>
            <span>Farewell messages</span>
          </div>
        </div>
        {confirmCancel ? (
          <div className="mt-3 border-t border-green-200 pt-3">
            <p className="text-xs text-green-800">
              Cancel auto-renewal? You keep full vault access until {expiryDate || "your term ends"} — nothing is lost before then.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={handleCancel} disabled={cancelling} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                {cancelling ? "Cancelling..." : "Yes, cancel renewal"}
              </button>
              <button onClick={() => setConfirmCancel(false)} disabled={cancelling} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-green-300 text-green-800 hover:bg-green-100 transition-colors disabled:opacity-50">
                Keep subscription
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 border-t border-green-200 pt-2 text-right">
            <button onClick={() => setConfirmCancel(true)} className="text-xs font-medium text-green-700 underline hover:text-green-900 transition-colors">
              Cancel subscription
            </button>
          </div>
        )}
      </div>
    );
  }

  if (sub.status === "past_due") {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-800">Payment Failed</p>
          <p className="text-xs text-amber-600">Please update your payment method to continue your vault benefits.</p>
        </div>
        <a href="/dashboard/settings" className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors">
          Update Payment
        </a>
      </div>
    );
  }

  if (sub.status === "cancelled") {
    const expiryDate = sub.expiry ? new Date(sub.expiry).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
    const stillActive = sub.cancelAtPeriodEnd || sub.canUseFarewell;
    const nearExpiry = stillActive && sub.daysRemaining !== null && sub.daysRemaining <= 30;
    // While access is still live the subscription is only set to cancel at period
    // end — the button resumes that same subscription (server-side, no new charge).
    // Once access has ended it is a genuine new purchase. Label/copy reflect which.
    const ctaLabel = stillActive ? "Reactivate" : "Resubscribe";
    if (nearExpiry) {
      return (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Vault access ends in {sub.daysRemaining} day{sub.daysRemaining === 1 ? "" : "s"}{expiryDate ? ` (${expiryDate})` : ""}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            After that you&apos;ll lose access to uploads, farewell messages, and downloads. Reactivate to keep everything — you won&apos;t be charged now, billing just resumes{expiryDate ? ` on ${expiryDate}` : " at your renewal date"}. Or download your documents from the categories below before access ends.
          </p>
          <div className="mt-3">
            <button onClick={handleSubscribe} disabled={subscribing} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gold text-white hover:bg-gold-600 transition-colors disabled:opacity-50">
              {subscribing ? "Loading..." : ctaLabel}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-charcoal">
            {stillActive ? "Auto-renewal off" : "Subscription Cancelled"}
          </p>
          {stillActive
            ? expiryDate && <p className="text-xs text-gray-500">Access continues until {expiryDate} — reactivate anytime, no charge until then.</p>
            : <p className="text-xs text-gray-500">Your vault access has ended.</p>}
        </div>
        <button onClick={handleSubscribe} disabled={subscribing} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gold text-white hover:bg-gold-600 transition-colors disabled:opacity-50">
          {subscribing ? "Loading..." : ctaLabel}
        </button>
      </div>
    );
  }

  // status === "none", promotional
  return (
    <div className="rounded-xl bg-navy/5 border border-navy/10 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-navy">Upgrade to Vault Plan, {formatPrice(PRICES.vaultSubscriptionYear)}/year</p>
          <ul className="mt-2 space-y-1">
            <li className="flex items-center gap-2 text-xs text-charcoal/70">
              <span className="text-gold">&#10003;</span> Unlimited free document amendments
            </li>
            <li className="flex items-center gap-2 text-xs text-charcoal/70">
              <span className="text-gold">&#10003;</span> Record farewell video messages for loved ones
            </li>
            <li className="flex items-center gap-2 text-xs text-charcoal/70">
              <span className="text-gold">&#10003;</span> Annual review reminders
            </li>
            <li className="flex items-center gap-2 text-xs text-charcoal/70">
              <span className="text-gold">&#10003;</span> Priority document processing
            </li>
          </ul>
        </div>
        <button onClick={handleSubscribe} disabled={subscribing} className="flex-shrink-0 px-4 py-2 rounded-full bg-gold text-sm font-semibold text-white hover:bg-gold-600 transition-colors disabled:opacity-50">
          {subscribing ? "Loading..." : "Subscribe"}
        </button>
      </div>
    </div>
  );
}
