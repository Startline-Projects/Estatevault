"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SetupPinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partner = searchParams.get("partner") || "";

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (pin.length !== 4) {
      setError("PIN must be 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match. Please try again.");
      setConfirmPin("");
      return;
    }

    setLoading(true);

    // Ensure user is authenticated
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const returnTo = `/auth/vault-pin${partner ? `?partner=${partner}` : ""}`;
      router.push(`/auth/login?redirect=${encodeURIComponent(returnTo)}`);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/vault/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", pin }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to set PIN.");
      setLoading(false);
      return;
    }

    // Always send users to the authenticated vault experience after PIN setup.
    window.location.assign("/dashboard/vault");
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-white">Set Your Vault PIN</h1>
          <p className="mt-2 text-sm text-white/60">
            Your vault is protected by a separate 4-digit PIN. Keep it safe.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-navy mb-1">
                Create PIN
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-center text-2xl tracking-[0.75em] font-mono text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
                placeholder="••••"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="confirmPin" className="block text-sm font-medium text-navy mb-1">
                Confirm PIN
              </label>
              <input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                required
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-center text-2xl tracking-[0.75em] font-mono text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
                placeholder="••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
              className="w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Setting PIN..." : "Set PIN & Enter Vault"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-charcoal/50">
            Your PIN is encrypted and never stored in plain text.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VaultPinPage() {
  return (
    <Suspense>
      <SetupPinForm />
    </Suspense>
  );
}
