"use client";

import { useState, useEffect } from "react";
import { PRICES, formatPrice } from "@/lib/orders/pricing";
import { getStatus } from "@/lib/api-client/subscription";
import { checkoutVaultSubscription } from "@/lib/api-client/checkout";

interface SubscriptionStatus {
  status: string;
  expiry: string | null;
  canAmendFree: boolean;
  canUseFarewell: boolean;
}

type StatusInput = {
  status: string;
  expiry?: string | null;
  canAmendFree?: boolean;
  canUseFarewell?: boolean;
};

function normalize(s: StatusInput): SubscriptionStatus {
  const active = s.status === "active";
  return {
    status: s.status,
    expiry: s.expiry ?? null,
    canAmendFree: s.canAmendFree ?? active,
    canUseFarewell: s.canUseFarewell ?? active,
  };
}

export default function SubscriptionBanner({ onStatusLoaded, status: statusProp }: { onStatusLoaded?: (status: SubscriptionStatus) => void; status?: StatusInput | null }) {
  // When the `status` prop is present (even null), the parent owns the fetch — defer to it
  // and never make our own request. When omitted (undefined), fetch standalone.
  const managed = statusProp !== undefined;
  const [sub, setSub] = useState<SubscriptionStatus | null>(statusProp ? normalize(statusProp) : null);
  const [loading, setLoading] = useState(!managed);
  const [subscribing, setSubscribing] = useState(false);

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

  if (loading || !sub) return null;

  if (sub.status === "active") {
    const expiryDate = sub.expiry ? new Date(sub.expiry).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center justify-between">
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
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-charcoal">Subscription Cancelled</p>
          {expiryDate && <p className="text-xs text-gray-500">Access continues until {expiryDate}</p>}
        </div>
        <button onClick={handleSubscribe} disabled={subscribing} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gold text-white hover:bg-gold-600 transition-colors disabled:opacity-50">
          {subscribing ? "Loading..." : "Resubscribe"}
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
