"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MnemonicInput } from "@/components/recover/MnemonicInput";
import { PassphraseForm } from "@/components/onboarding/PassphraseForm";
import { getKeySession } from "@/lib/crypto/keySession";
import { getRecoveryBundle, postRotatePassphrase } from "@/lib/repos/cryptoRepo";
import { getCryptoWorker } from "@/lib/crypto/worker/client";

type Step = "mnemonic" | "new-passphrase" | "done";

export default function RecoverPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mnemonic");
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleMnemonic(m: string) {
    setBusy(true);
    setErr(null);
    try {
      const rec = await getRecoveryBundle();
      await getKeySession().unlockWithMnemonic({
        mnemonic: m,
        wrappedMkRecovery: rec.wrappedMkRecovery,
      });
      setMnemonic(m);
      setStep("new-passphrase");
    } catch (e) {
      setErr("Recovery failed. Phrase may be incorrect or vault not bootstrapped.");
      await getKeySession().lock();
    } finally {
      setBusy(false);
    }
  }

  async function handleNewPassphrase(newPp: string) {
    setBusy(true);
    setErr(null);
    try {
      const worker = getCryptoWorker();
      const out = await worker.rewrapPassphraseFromUnlocked({ newPassphrase: newPp });
      await postRotatePassphrase({
        salt: out.salt,
        kdfParams: out.kdfParams,
        wrappedMkPass: out.wrappedMkPass,
      });
      setMnemonic(null);
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
        <h1 className="text-2xl font-semibold text-[#1C3557] mb-1">Recover vault</h1>
        <p className="text-sm text-[#2D2D2D] mb-6">
          {step === "mnemonic" && "Enter your 24-word recovery phrase to regain access."}
          {step === "new-passphrase" && "Set a new passphrase. This replaces your old one."}
          {step === "done" && "Vault recovered."}
        </p>

        {err && (
          <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {err}
          </div>
        )}

        {step === "mnemonic" && <MnemonicInput onSubmit={handleMnemonic} busy={busy} />}
        {step === "new-passphrase" && mnemonic && (
          <PassphraseForm onSubmit={handleNewPassphrase} busy={busy} />
        )}
      </div>
    </main>
  );
}
