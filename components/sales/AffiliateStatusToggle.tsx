"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { affiliateStatus } from "@/lib/api-client/sales";

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
      const { error } = await affiliateStatus(affiliateId, next);
      if (error) {
        alert(error);
      } else {
        router.refresh();
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
