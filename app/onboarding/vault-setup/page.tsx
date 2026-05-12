"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PassphraseForm } from "@/components/onboarding/PassphraseForm";
import { MnemonicDisplay } from "@/components/onboarding/MnemonicDisplay";
import { MnemonicConfirm } from "@/components/onboarding/MnemonicConfirm";
import { getKeySession } from "@/lib/crypto/keySession";
import { postBootstrap } from "@/lib/repos/cryptoRepo";

type Step = "pin" | "passphrase" | "show" | "confirm" | "done";

type Pending = {
  mnemonic: string;
  bootstrapInput: Parameters<typeof postBootstrap>[0];
};

export default function VaultSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pin");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  useEffect(() => {
    fetch("/api/vault/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check" }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.hasPin) setStep("passphrase");
      })
      .catch(() => {});
  }, []);

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^\d{4}$/.test(pin)) {
      setErr("PIN must be 4 digits.");
      return;
    }
    if (pin !== pinConfirm) {
      setErr("PINs do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/vault/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", pin }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to set PIN");
      }
      setPin("");
      setPinConfirm("");
      setStep("passphrase");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePassphrase(passphrase: string) {
    setBusy(true);
    setErr(null);
    try {
      const out = await getKeySession().bootstrap({ passphrase });
      setPending({
        mnemonic: out.mnemonic,
        bootstrapInput: {
          salt: out.salt,
          kdfParams: out.kdfParams,
          wrappedMkPass: out.wrappedMkPass,
          wrappedMkRecovery: out.wrappedMkRecovery,
          pubX25519: out.pubX25519,
          pubEd25519: out.pubEd25519,
        },
      });
      setStep("show");
    } catch (e) {
      setErr((e as Error).message);
      await getKeySession().lock();
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmed() {
    if (!pending) return;
    setBusy(true);
    setErr(null);
    try {
      await postBootstrap(pending.bootstrapInput);
      // Wipe mnemonic from React state immediately.
      setPending(null);
      setStep("done");
      router.replace("/dashboard");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F4ED] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-semibold text-[#1C3557] mb-1">Set up your vault</h1>
        <p className="text-sm text-[#2D2D2D] mb-6">
          {step === "pin" && "Create a 4-digit PIN. You'll use this each time you access your vault."}
          {step === "passphrase" && "Choose a passphrase. Only you will know it."}
          {step === "show" && "Save your 24-word recovery phrase."}
          {step === "confirm" && "Confirm your recovery phrase."}
          {step === "done" && "Vault ready."}
        </p>

        {err && (
          <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {err}
          </div>
        )}

        {step === "pin" && (
          <form onSubmit={handlePin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#2D2D2D] mb-1">PIN (4 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:border-[#1C3557]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:border-[#1C3557]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy || pin.length !== 4 || pinConfirm.length !== 4}
              className="w-full bg-[#1C3557] text-white rounded py-2 font-medium disabled:opacity-50"
            >
              {busy ? "Saving…" : "Continue"}
            </button>
          </form>
        )}

        {step === "passphrase" && (
          <PassphraseForm onSubmit={handlePassphrase} busy={busy} />
        )}

        {step === "show" && pending && (
          <MnemonicDisplay
            mnemonic={pending.mnemonic}
            onContinue={() => setStep("confirm")}
          />
        )}

        {step === "confirm" && pending && (
          <MnemonicConfirm
            mnemonic={pending.mnemonic}
            onConfirmed={handleConfirmed}
            busy={busy}
          />
        )}
      </div>
    </main>
  );
}
