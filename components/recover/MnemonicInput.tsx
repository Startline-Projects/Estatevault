"use client";

import { useMemo, useState } from "react";
import { validateMnemonic } from "bip39";

export function MnemonicInput({
  onSubmit,
  busy,
}: {
  onSubmit: (mnemonic: string) => void | Promise<void>;
  busy?: boolean;
}) {
  const [words, setWords] = useState<string[]>(Array(24).fill(""));
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState("");

  const joined = useMemo(() => words.map((w) => w.trim().toLowerCase()).join(" ").trim(), [words]);
  const valid = words.every((w) => w.trim().length > 0) && validateMnemonic(joined);

  function applyBulk() {
    const tokens = bulk.trim().toLowerCase().split(/\s+/);
    if (tokens.length === 24) {
      setWords(tokens);
      setBulkOpen(false);
      setBulk("");
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(joined); }}
      className="space-y-5"
    >
      {bulkOpen ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#2D2D2D]">Paste 24 words</label>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={3}
            autoFocus
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#1C3557]"
          />
          <div className="flex gap-2">
            <button type="button" onClick={applyBulk} className="text-xs bg-[#1C3557] text-white rounded px-3 py-1">
              Apply
            </button>
            <button type="button" onClick={() => { setBulkOpen(false); setBulk(""); }} className="text-xs underline">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {words.map((w, i) => (
              <label key={i} className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 bg-white">
                <span className="text-xs text-gray-500 w-5 text-right tabular-nums">{i + 1}.</span>
                <input
                  value={w}
                  onChange={(e) => setWords((arr) => { const n = [...arr]; n[i] = e.target.value; return n; })}
                  autoComplete="off"
                  className="flex-1 text-sm focus:outline-none bg-transparent"
                  required
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setBulkOpen(true)} className="text-xs text-[#C9A84C] underline">
            Paste all at once
          </button>
        </>
      )}

      {!valid && joined.length > 0 && words.every((w) => w.trim()) && (
        <p className="text-xs text-red-700">
          Phrase didn&apos;t validate. Check spelling and word order.
        </p>
      )}

      <button
        type="submit"
        disabled={!valid || busy}
        className="w-full bg-[#1C3557] text-white rounded py-2 font-medium disabled:opacity-50"
      >
        {busy ? "Verifying…" : "Continue"}
      </button>
    </form>
  );
}
