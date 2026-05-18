"use client";

import { useEffect, useState } from "react";
import { getKeySession } from "@/lib/crypto/keySession";
import type { LockState } from "@/lib/crypto/worker/types";

const SESSION_MK_KEY = "vault:session-mk";

function hasSessionMk(): boolean {
  if (typeof window === "undefined") return false;
  try { return !!sessionStorage.getItem(SESSION_MK_KEY); } catch { return false; }
}

export function useVaultLock() {
  const [state, setState] = useState<LockState>(() =>
    typeof window === "undefined" ? "locked" : getKeySession().getState(),
  );
  // True only while a sessionStorage-backed restore is in flight. Lets callers
  // (e.g. UnlockModal, trustees page) suppress the passphrase prompt until the
  // auto-unlock attempt finishes.
  const [restoring, setRestoring] = useState<boolean>(() => hasSessionMk());

  useEffect(() => {
    const session = getKeySession();
    setState(session.getState());
    const unsub = session.subscribe(setState);
    if (hasSessionMk() && session.getState() !== "unlocked") {
      setRestoring(true);
      session.tryRestoreFromSession()
        .catch(() => undefined)
        .finally(() => setRestoring(false));
    } else {
      setRestoring(false);
    }
    return unsub;
  }, []);

  return {
    state,
    isLocked: state !== "unlocked",
    restoring,
    lock: () => getKeySession().lock(),
    unlockWithPassphrase: (args: Parameters<ReturnType<typeof getKeySession>["unlockWithPassphrase"]>[0]) =>
      getKeySession().unlockWithPassphrase(args),
    unlockWithMnemonic: (args: Parameters<ReturnType<typeof getKeySession>["unlockWithMnemonic"]>[0]) =>
      getKeySession().unlockWithMnemonic(args),
    bootstrap: (args: { passphrase: string }) => getKeySession().bootstrap(args),
  };
}
