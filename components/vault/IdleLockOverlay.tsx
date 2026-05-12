"use client";

import { useVaultLock } from "@/hooks/useVaultLock";

// Minimal lock overlay. Phase 5 will replace with full unlock modal (passphrase form, recovery link).
export function IdleLockOverlay() {
  const { isLocked } = useVaultLock();
  if (!isLocked) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md text-center">
        <h2 className="text-lg font-semibold text-[#1C3557] mb-2">Vault locked</h2>
        <p className="text-sm text-[#2D2D2D] mb-4">
          Your vault locked due to inactivity. Re-enter your passphrase to continue.
        </p>
        <a href="/dashboard" className="text-[#C9A84C] underline text-sm">Unlock vault</a>
      </div>
    </div>
  );
}
