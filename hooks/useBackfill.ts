"use client";

import { useEffect, useRef, useState } from "react";
import { useVaultLock } from "./useVaultLock";
import { getBackfillStatus, runBackfill, type BackfillStatus } from "@/lib/repos/backfillRepo";

export function useBackfill() {
  const { state } = useVaultLock();
  const [status, setStatus] = useState<BackfillStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Probe status on mount (regardless of lock state, so banner shows on locked page).
  useEffect(() => {
    getBackfillStatus().then(setStatus).catch(() => undefined);
  }, []);

  // Auto-run only when vault unlocked and there is work pending.
  useEffect(() => {
    if (state !== "unlocked") return;
    if (!status || status.complete || running || startedRef.current) return;
    if (status.totalRemaining === 0) return;

    startedRef.current = true;
    setRunning(true);
    runBackfill({
      onProgress: () => {
        getBackfillStatus().then(setStatus).catch(() => undefined);
      },
    })
      .then(setStatus)
      .catch((e) => setError((e as Error).message))
      .finally(() => setRunning(false));
  }, [state, status, running]);

  return { status, running, error };
}
