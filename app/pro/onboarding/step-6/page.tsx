"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Step6Page() {
  const router = useRouter();
  const [method, setMethod] = useState<"stripe" | "ach" | "">("");
  const [partnerId, setPartnerId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [connectError, setConnectError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase.from("partners").select("id, stripe_account_id").eq("profile_id", user.id).single();
      if (partner) {
        setPartnerId(partner.id);
        if (partner.stripe_account_id) {
          setMethod("stripe");
          setStripeConnected(true);
        }
      }
    }
    load();
  }, []);

  async function handleStripeConnect() {
    setConnecting(true);
    setConnectError("");
    try {
      const res = await fetch("/api/partner/stripe-connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect Stripe");
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Something went wrong");
      setConnecting(false);
    }
  }

  async function handleContinue() {
    const supabase = createClient();
    await supabase.from("partners").update({ onboarding_step: 7 }).eq("id", partnerId);
    router.push("/pro/onboarding/step-7");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Set Up Your Payouts</h1>
      <p className="mt-1 text-sm text-charcoal/60">Get paid every Friday for completed documents.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div onClick={() => setMethod("stripe")} className={`rounded-xl border-2 p-6 cursor-pointer transition-all ${method === "stripe" ? "border-gold bg-gold/5" : "border-gray-200 hover:border-gold/40"}`}>
          <h3 className="text-base font-bold text-navy">Stripe Connect</h3>
          <span className="text-xs text-gold font-medium">Recommended</span>
          <p className="mt-2 text-sm text-charcoal/60">Connect your bank account through Stripe. Fastest setup. Payouts in 2-3 business days.</p>
          {method === "stripe" && (
            stripeConnected ? (
              <p className="mt-4 text-sm text-green-600 font-medium">&#10003; Stripe account connected</p>
            ) : (
              <>
                <button
                  onClick={handleStripeConnect}
                  disabled={connecting}
                  className="mt-4 rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy/90 transition-colors disabled:opacity-50"
                >
                  {connecting ? "Connecting..." : "Connect with Stripe"}
                </button>
                {connectError && (
                  <p className="mt-2 text-xs text-red-600">{connectError}</p>
                )}
              </>
            )
          )}
        </div>
        <div onClick={() => setMethod("ach")} className={`rounded-xl border-2 p-6 cursor-pointer transition-all ${method === "ach" ? "border-gold bg-gold/5" : "border-gray-200 hover:border-gold/40"}`}>
          <h3 className="text-base font-bold text-navy">Bank Transfer (ACH)</h3>
          <p className="mt-2 text-sm text-charcoal/60">Direct bank deposit. Requires 2-3 day verification.</p>
          {method === "ach" && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-800 font-medium">Coming soon</p>
              <p className="text-xs text-amber-700 mt-1">ACH bank transfers are not yet available. Please use Stripe Connect for now.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-6">
        <p className="text-sm font-semibold text-navy">💰 Payout Schedule</p>
        <ul className="mt-3 space-y-1 text-sm text-charcoal/60">
          <li>• Payouts every Friday</li>
          <li>• Minimum payout: $50</li>
          <li>• Earnings below $50 roll to the following week</li>
          <li>• Your first payout arrives within 7 days of your first completed document</li>
        </ul>
      </div>

      {!method && (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You can complete payout setup after launch. You won&apos;t receive earnings until your payout method is configured.
        </div>
      )}

      <button onClick={handleContinue} className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">Continue</button>
    </div>
  );
}
