"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AffiliateStatusToggle({
  affiliateId,
  status,
}: {
  affiliateId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const suspended = status === "suspended";

  async function toggle() {
    const next = suspended ? "active" : "suspended";
    const msg = suspended
      ? "Reactivate this affiliate? Their referral links will start converting again."
      : "Suspend this affiliate? Their referral links will stop converting.";
    if (!confirm(msg)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/sales/affiliates/${affiliateId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update status.");
      }
    } catch {
      alert("Failed to update status.");
    }
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
        suspended
          ? "bg-green-600 text-white hover:bg-green-700"
          : "bg-red-600 text-white hover:bg-red-700"
      }`}
    >
      {busy
        ? "Updating..."
        : suspended
        ? "Reactivate Affiliate"
        : "Suspend Affiliate"}
    </button>
  );
}
