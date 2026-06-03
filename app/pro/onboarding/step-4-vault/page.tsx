"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { stripeConnectOnboard } from "@/lib/api-client/misc";
import { getMe } from "@/lib/api-client/partner";

export default function Step4VaultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [alreadyConnected, setAlreadyConnected] = useState(false);
  const [error, setError] = useState("");

  function goToDashboard() {
    window.location.assign("/pro/dashboard");
  }

  useEffect(() => {
    async function load() {
      const { data } = await getMe();
      const partner = data?.partner;
      if (!partner || partner.tier !== "basic") { router.push("/pro/dashboard"); return; }
      if (partner.stripe_account_id) setAlreadyConnected(true);
      if (searchParams.get("stripe_connect") === "success") {
        goToDashboard();
        return;
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleConnect() {
    setConnecting(true);
    setError("");
    try {
      const { data, error } = await stripeConnectOnboard({ returnPath: "/pro/onboarding/step-4-vault" });
      if (!error && data?.url) {
        window.location.href = data.url;
      } else {
        setError(error || "Failed to start Stripe onboarding");
        setConnecting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setConnecting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="mb-8">
        <p className="text-sm font-medium text-gold mb-1">Step 4 of 4</p>
        <h1 className="text-2xl font-bold text-navy">Connect Stripe for Payouts</h1>
        <p className="mt-2 text-sm text-charcoal/60">
          When clients buy vault subscriptions through your panel, your revenue share gets deposited directly to your Stripe account.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 space-y-4">
        {alreadyConnected ? (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">Connected</span>
            <span className="text-sm text-charcoal/70">Your Stripe account is already connected.</span>
          </div>
        ) : (
          <>
            <div className="space-y-3 text-sm text-charcoal/70">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-gold">✓</span>
                <span>Instant payouts — revenue deposits automatically after each sale</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-gold">✓</span>
                <span>No manual invoicing — Stripe handles all transfers</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-gold">✓</span>
                <span>Takes ~5 minutes to complete Stripe onboarding</span>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {connecting ? "Redirecting to Stripe..." : "Connect with Stripe"}
            </button>
          </>
        )}
      </div>

      <button
        onClick={goToDashboard}
        className="mt-4 w-full text-center text-sm text-charcoal/50 hover:text-charcoal transition-colors py-2"
      >
        Skip for now — I&apos;ll connect later in Settings
      </button>
    </div>
  );
}
