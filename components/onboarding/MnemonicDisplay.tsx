"use client";

import { useEffect, useState } from "react";

export function MnemonicDisplay({
  mnemonic,
  onContinue,
}: {
  mnemonic: string;
  onContinue: () => void;
}) {
  const words = mnemonic.split(/\s+/);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-clear clipboard after copy.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => {
      navigator.clipboard?.writeText("").catch(() => undefined);
      setCopied(false);
    }, 30_000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="space-y-5">
      <div className="rounded bg-amber-50 border border-amber-300 p-3 text-sm text-amber-900">
        <strong>Write down these 24 words now.</strong> They are your only recovery if you forget your passphrase.
        EstateVault cannot show them to you again.
      </div>

      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {words.map((w, i) => (
          <li key={i} className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1 bg-white">
            <span className="text-xs text-gray-500 w-5 text-right tabular-nums">{i + 1}.</span>
            <span className="font-medium text-[#1C3557]">{w}</span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(mnemonic);
          setCopied(true);
        }}
        className="text-sm text-[#C9A84C] underline"
      >
        {copied ? "Copied — clipboard clears in 30 s" : "Copy to clipboard"}
      </button>

      <label className="flex items-start gap-2 text-sm text-[#2D2D2D]">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I have written down or stored these 24 words in a safe place.
          I understand they cannot be shown again.
        </span>
      </label>

      <button
        type="button"
        disabled={!acknowledged}
        onClick={onContinue}
        className="w-full bg-[#1C3557] text-white rounded py-2 font-medium disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}
