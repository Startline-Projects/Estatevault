"use client";

import { useMemo, useState } from "react";
import zxcvbn from "zxcvbn";

const MIN_LEN = 12;
const MIN_SCORE = 3;

const STRENGTH_LABEL = ["very weak", "weak", "fair", "strong", "excellent"];
const STRENGTH_COLOR = ["#b91c1c", "#dc2626", "#ca8a04", "#65a30d", "#15803d"];

export function PassphraseForm({
  onSubmit,
  busy,
}: {
  onSubmit: (passphrase: string) => void | Promise<void>;
  busy?: boolean;
}) {
  const [pp1, setPp1] = useState("");
  const [pp2, setPp2] = useState("");
  const [show, setShow] = useState(false);

  const score = useMemo(() => (pp1 ? zxcvbn(pp1).score : 0), [pp1]);
  const tooShort = pp1.length > 0 && pp1.length < MIN_LEN;
  const weak = pp1.length >= MIN_LEN && score < MIN_SCORE;
  const mismatch = pp2.length > 0 && pp1 !== pp2;
  const ok = pp1.length >= MIN_LEN && score >= MIN_SCORE && pp1 === pp2 && !busy;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(pp1); }}
      className="space-y-5"
    >
      <div>
        <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Passphrase</label>
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={pp1}
          onChange={(e) => setPp1(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:border-[#1C3557]"
          aria-invalid={tooShort || weak}
          required
        />
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 bg-gray-200 rounded">
            <div
              className="h-1 rounded transition-all"
              style={{
                width: `${(score / 4) * 100}%`,
                backgroundColor: STRENGTH_COLOR[score],
              }}
            />
          </div>
          <span className="text-xs text-[#2D2D2D]">{pp1 ? STRENGTH_LABEL[score] : "—"}</span>
        </div>
        {tooShort && <p className="text-xs text-red-700 mt-1">Minimum {MIN_LEN} characters.</p>}
        {!tooShort && weak && <p className="text-xs text-red-700 mt-1">Too predictable. Try a longer mix of words.</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Confirm passphrase</label>
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={pp2}
          onChange={(e) => setPp2(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:border-[#1C3557]"
          aria-invalid={mismatch}
          required
        />
        {mismatch && <p className="text-xs text-red-700 mt-1">Passphrases do not match.</p>}
      </div>

      <label className="flex items-center gap-2 text-sm text-[#2D2D2D]">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show passphrase
      </label>

      <div className="rounded bg-[#1C3557]/5 border border-[#1C3557]/20 p-3 text-xs text-[#2D2D2D]">
        Your passphrase encrypts everything in your vault. EstateVault never sees it.
        If you forget it and lose your recovery phrase, your vault cannot be recovered.
      </div>

      <button
        type="submit"
        disabled={!ok}
        className="w-full bg-[#1C3557] text-white rounded py-2 font-medium disabled:opacity-50"
      >
        {busy ? "Setting up vault…" : "Continue"}
      </button>
    </form>
  );
}
