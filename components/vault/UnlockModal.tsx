"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getKeySession } from "@/lib/crypto/keySession";
import { getBundle } from "@/lib/repos/cryptoRepo";
import type { LockState } from "@/lib/crypto/worker/types";

type Mode = "passphrase" | "rate-limited";

export function UnlockModal({ entitled = false }: { entitled?: boolean }) {
  const [state, setState] = useState<LockState>(() =>
    typeof window === "undefined" ? "locked" : getKeySession().getState(),
  );
  const [pp, setPp] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("passphrase");
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null);
  const [hasPin, setHasPin] = useState<boolean | null>(null);

  useEffect(() => {
    const session = getKeySession();
    setState(session.getState());
    return session.subscribe(setState);
  }, []);

  useEffect(() => {
    if (!entitled) return;
    if (state !== "unlocked" && bootstrapped === null) {
      fetch("/api/crypto/bundle", { method: "HEAD" })
        .then((r) => setBootstrapped(r.status !== 404))
        .catch(() => setBootstrapped(true));
    }
    if (state !== "unlocked" && hasPin === null) {
      fetch("/api/vault/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      })
        .then((r) => r.json())
        .then((j) => setHasPin(!!j.hasPin))
        .catch(() => setHasPin(false));
    }
  }, [state, bootstrapped, hasPin, entitled]);

  if (!entitled) return null;
  if (state === "unlocked") return null;

  if (hasPin === false) {
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md text-center">
          <h2 className="text-lg font-semibold text-[#1C3557] mb-2">Set up your vault PIN</h2>
          <p className="text-sm text-[#2D2D2D] mb-4">Create a 4-digit PIN to access your vault.</p>
          <Link href="/onboarding/vault-setup" className="inline-block bg-[#1C3557] text-white rounded px-4 py-2 text-sm">
            Set up PIN
          </Link>
        </div>
      </div>
    );
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const bundle = await getBundle();
      await getKeySession().unlockWithPassphrase({
        passphrase: pp,
        salt: bundle.salt,
        kdfParams: bundle.kdfParams,
        wrappedMkPass: bundle.wrappedMkPass,
      });
      setPp("");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("429")) setMode("rate-limited");
      setErr(msg.includes("429") ? "Too many attempts. Try again shortly." : "Wrong passphrase.");
    } finally {
      setBusy(false);
    }
  }

  if (bootstrapped === false) {
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md text-center">
          <h2 className="text-lg font-semibold text-[#1C3557] mb-2">Set up your vault</h2>
          <p className="text-sm text-[#2D2D2D] mb-4">You haven&apos;t created a passphrase yet.</p>
          <Link href="/onboarding/vault-setup" className="inline-block bg-[#1C3557] text-white rounded px-4 py-2 text-sm">
            Set up vault
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleUnlock} autoComplete="off" className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold text-[#1C3557]">Unlock vault</h2>
        <p className="text-sm text-[#2D2D2D]">Enter your passphrase to decrypt your vault.</p>

        <div>
          <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Passphrase</label>
          <input
            type={show ? "text" : "password"}
            autoFocus
            autoComplete="off"
            name="vault-passphrase"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            value={pp}
            onChange={(e) => setPp(e.target.value)}
            disabled={mode === "rate-limited" || busy}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:border-[#1C3557]"
            required
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-[#2D2D2D]">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Show passphrase
        </label>

        {err && <p className="text-sm text-red-700">{err}</p>}

        <button
          type="submit"
          disabled={!pp || busy || mode === "rate-limited"}
          className="w-full bg-[#1C3557] text-white rounded py-2 font-medium disabled:opacity-50"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>

        <div className="text-center text-xs text-[#2D2D2D]">
          <Link href="/recover" className="text-[#C9A84C] underline">Forgot passphrase? Recover with 24-word phrase</Link>
        </div>
      </form>
    </div>
  );
}
