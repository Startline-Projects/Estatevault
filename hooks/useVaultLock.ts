"use client";

import { useEffect, useState } from "react";
import { getKeySession } from "@/lib/crypto/keySession";
import type { LockState } from "@/lib/crypto/worker/types";

export function useVaultLock() {
  const [state, setState] = useState<LockState>(() =>
    typeof window === "undefined" ? "locked" : getKeySession().getState(),
  );

  useEffect(() => {
    const session = getKeySession();
    setState(session.getState());
    return session.subscribe(setState);
  }, []);

  return {
    state,
    isLocked: state !== "unlocked",
    lock: () => getKeySession().lock(),
    unlockWithPassphrase: (args: Parameters<ReturnType<typeof getKeySession>["unlockWithPassphrase"]>[0]) =>
      getKeySession().unlockWithPassphrase(args),
    unlockWithMnemonic: (args: Parameters<ReturnType<typeof getKeySession>["unlockWithMnemonic"]>[0]) =>
      getKeySession().unlockWithMnemonic(args),
    bootstrap: (args: { passphrase: string }) => getKeySession().bootstrap(args),
  };
}
