"use client";

import { useBackfill } from "@/hooks/useBackfill";

// Discreet progress banner. Appears only when there is legacy plaintext to
// migrate; auto-hides on completion.
export function BackfillBanner() {
  const { status, running, error } = useBackfill();
  if (!status || status.complete || status.totalRemaining === 0) return null;

  return (
    <div className="rounded-md border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-3 text-sm text-[#1C3557] flex items-center justify-between">
      <div>
        <strong>Securing your vault…</strong>{" "}
        {error
          ? <span className="text-red-700">{error}</span>
          : <span>
              Encrypting {status.totalRemaining} legacy item{status.totalRemaining === 1 ? "" : "s"}.
              Keep this tab open.
            </span>}
      </div>
      {running && <span className="text-xs text-[#2D2D2D]">Working…</span>}
    </div>
  );
}
