"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function fmtDollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export default function AffiliatePayoutButton({
  affiliateId,
  unpaidCents,
  stripeReady,
}: {
  affiliateId: string;
  unpaidCents: number;
  stripeReady: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const nothingOwed = unpaidCents <= 0;
  const disabled = busy || nothingOwed || !stripeReady;

  let title = "";
  if (!stripeReady) title = "Affiliate must finish Stripe onboarding first";
  else if (nothingOwed) title = "No unpaid balance";

  async function payOut() {
    const ok = confirm(
      `Send ${fmtDollars(
        unpaidCents
      )} to this affiliate via Stripe? This transfers real funds and cannot be undone.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/sales/affiliates/${affiliateId}/payout`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(`Payout of ${fmtDollars(data.amount_cents ?? unpaidCents)} sent.`);
        router.refresh();
      } else {
        alert(data.error || "Payout failed.");
      }
    } catch {
      alert("Payout failed.");
    }
    setBusy(false);
  }

  return (
    <button
      onClick={payOut}
      disabled={disabled}
      title={title}
      className="px-4 py-2 rounded-lg text-sm font-medium transition bg-gold text-navy hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {busy
        ? "Sending..."
        : nothingOwed
        ? "Nothing to Pay Out"
        : `Pay Out ${fmtDollars(unpaidCents)}`}
    </button>
  );
}
