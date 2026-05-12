"use client";

import { useMemo, useState } from "react";

function pickIndices(): number[] {
  const set = new Set<number>();
  while (set.size < 3) set.add(Math.floor(Math.random() * 24));
  return Array.from(set).sort((a, b) => a - b);
}

export function MnemonicConfirm({
  mnemonic,
  onConfirmed,
  busy,
}: {
  mnemonic: string;
  onConfirmed: () => void | Promise<void>;
  busy?: boolean;
}) {
  const words = mnemonic.split(/\s+/);
  const [indices] = useState<number[]>(pickIndices);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const allCorrect = useMemo(
    () => indices.every((i) => (inputs[i] ?? "").trim().toLowerCase() === words[i]),
    [indices, inputs, words],
  );

  const wrongIndices = submitted
    ? indices.filter((i) => (inputs[i] ?? "").trim().toLowerCase() !== words[i])
    : [];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (allCorrect) onConfirmed();
      }}
      className="space-y-5"
    >
      <p className="text-sm text-[#2D2D2D]">
        To confirm you have your recovery phrase, type the requested words.
      </p>

      <div className="space-y-3">
        {indices.map((i) => (
          <div key={i}>
            <label className="block text-sm font-medium text-[#2D2D2D] mb-1">
              Word #{i + 1}
            </label>
            <input
              autoComplete="off"
              value={inputs[i] ?? ""}
              onChange={(e) => setInputs((s) => ({ ...s, [i]: e.target.value }))}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:border-[#1C3557]"
              aria-invalid={wrongIndices.includes(i)}
              required
            />
          </div>
        ))}
      </div>

      {submitted && !allCorrect && (
        <p className="text-sm text-red-700">
          One or more words don&apos;t match. Check your recovery phrase and try again.
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full bg-[#1C3557] text-white rounded py-2 font-medium disabled:opacity-50"
      >
        {busy ? "Finalizing…" : "Confirm & finish"}
      </button>
    </form>
  );
}
