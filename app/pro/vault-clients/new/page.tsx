"use client";

import { useState, useRef } from "react";
import Link from "next/link";

function generatePassword(length = 12) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const STEPS = ["Client Info", "Set PIN", "Review & Pay"];

export default function NewVaultClientPage() {
  const [step, setStep] = useState(1);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");

  const tempPasswordRef = useRef(generatePassword());
  const tempPassword = tempPasswordRef.current;

  const [copied, setCopied] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleStep1Continue() {
    if (!clientName.trim() || !clientEmail.trim()) return;
    setStep(2);
  }

  function handleStep2Continue() {
    setPinError("");
    if (pin.length !== 4) { setPinError("PIN must be 4 digits."); return; }
    if (pin !== confirmPin) { setPinError("PINs do not match."); setConfirmPin(""); return; }
    setStep(3);
  }

  async function handlePay() {
    if (!confirmed) return;
    setLoading(true);
    setError("");

    sessionStorage.setItem("vault_client_creds", JSON.stringify({
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim().toLowerCase(),
      tempPassword,
      pin,
    }));

    const res = await fetch("/api/partner/vault-client-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim().toLowerCase(),
        tempPassword,
        pin,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to process. Please try again.");
      setLoading(false);
      return;
    }

    window.location.assign(data.url);
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/pro/vault-clients" className="text-sm text-charcoal/60 hover:text-charcoal">← Vault Clients</Link>
      </div>

      <h1 className="text-2xl font-bold text-navy">Add Vault Client</h1>
      <p className="mt-1 text-sm text-charcoal/60">Create a vault for your client. You pay the $99/year fee.</p>

      {/* Step indicator */}
      <div className="mt-6 flex items-center gap-0">
        {STEPS.map((label, i) => {
          const num = i + 1;
          const active = step === num;
          const done = step > num;
          return (
            <div key={label} className="flex items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-green-500 text-white" : active ? "bg-gold text-white" : "bg-gray-200 text-charcoal/40"}`}>
                {done ? "✓" : num}
              </div>
              <span className={`ml-2 text-xs font-medium hidden sm:block ${active ? "text-navy" : "text-charcoal/40"}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`mx-3 h-px w-8 sm:w-12 ${done ? "bg-green-300" : "bg-gray-200"}`} />}
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">

        {/* ── Step 1: Client Info ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Client Full Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Client Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
              />
              <p className="mt-1 text-xs text-charcoal/50">This will be the client&apos;s login email for their vault.</p>
            </div>
            <button
              onClick={handleStep1Continue}
              disabled={!clientName.trim() || !clientEmail.trim()}
              className="w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 2: Set PIN ── */}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-charcoal/70">Set a 4-digit vault PIN for <span className="font-semibold text-navy">{clientName}</span>. Share this with them — they&apos;ll need it to access their vault.</p>

            {pinError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{pinError}</div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Create PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-center text-2xl tracking-[0.75em] font-mono text-charcoal focus:border-gold focus:outline-none"
                placeholder="••••"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-center text-2xl tracking-[0.75em] font-mono text-charcoal focus:border-gold focus:outline-none"
                placeholder="••••"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 min-h-[44px] rounded-full border border-gray-300 text-sm font-medium text-charcoal hover:bg-gray-50">Back</button>
              <button
                onClick={handleStep2Continue}
                disabled={pin.length !== 4 || confirmPin.length !== 4}
                className="flex-1 min-h-[44px] rounded-full bg-gold text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Pay ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">⚠ Save these credentials now</p>
              <p className="mt-0.5 text-xs text-amber-700">Copy them before paying. You will see them again on the success page, but note them somewhere safe.</p>
            </div>

            <div className="space-y-3">
              <CredRow label="Client Email" value={clientEmail.trim().toLowerCase()} copied={copied} onCopy={copyText} copyKey="email" />
              <CredRow label="Temporary Password" value={tempPassword} copied={copied} onCopy={copyText} copyKey="password" />
              <CredRow label="Vault PIN" value={pin} copied={copied} onCopy={copyText} copyKey="pin" />
            </div>

            <div className="rounded-xl bg-navy/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">Vault Subscription</p>
                <p className="text-xs text-charcoal/60">Annual · renews automatically</p>
              </div>
              <p className="text-lg font-bold text-navy">$99<span className="text-xs font-normal text-charcoal/60">/yr</span></p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-gold"
              />
              <span className="text-xs text-charcoal/70">I have saved the credentials above and will share them with my client.</span>
            </label>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} disabled={loading} className="flex-1 min-h-[44px] rounded-full border border-gray-300 text-sm font-medium text-charcoal hover:bg-gray-50 disabled:opacity-50">Back</button>
              <button
                onClick={handlePay}
                disabled={!confirmed || loading}
                className="flex-1 min-h-[44px] rounded-full bg-gold text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Pay $99/yr →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CredRow({ label, value, copied, onCopy, copyKey }: {
  label: string;
  value: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  copyKey: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-charcoal/50">{label}</p>
        <p className="mt-0.5 text-sm font-mono font-semibold text-navy break-all">{value}</p>
      </div>
      <button
        onClick={() => onCopy(value, copyKey)}
        className="ml-3 shrink-0 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-charcoal/70 hover:text-navy hover:border-navy transition-colors"
      >
        {copied === copyKey ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
