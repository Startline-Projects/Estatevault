"use client";

import type { Screen } from "./vault-constants";

interface VaultPinScreenProps {
  screen: Screen;
  pin: string;
  confirmPin: string;
  pinError: string;
  onPinChange: (value: string) => void;
  onConfirmPinChange: (value: string) => void;
  onPinErrorClear: () => void;
  onCreatePin: () => void;
  onVerifyPin: () => void;
}

export default function VaultPinScreen({
  screen,
  pin,
  confirmPin,
  pinError,
  onPinChange,
  onConfirmPinChange,
  onPinErrorClear,
  onCreatePin,
  onVerifyPin,
}: VaultPinScreenProps) {
  const hasPinError = pinError.length > 0;
  const pinErrorId = "pin-error-message";

  // Loading screen while checking PIN status
  if (screen === "pin-check") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-gold text-xl font-bold">Loading vault...</div>
      </div>
    );
  }

  // Create PIN screen
  if (screen === "pin-create") {
    return (
      <div className="max-w-sm mx-auto py-16 text-center">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center">
            <span className="text-3xl">🔐</span>
          </div>
        </div>
        <h1 className="mt-6 text-xl font-bold text-navy">Create Your Vault PIN</h1>
        <p className="mt-2 text-sm text-charcoal/60">
          Choose a 6-digit PIN to secure your vault. This is separate from your account password.
        </p>
        {hasPinError && (
          <p id={pinErrorId} className="mt-3 text-sm text-red-600" role="alert">
            {pinError}
          </p>
        )}
        <input
          type="password"
          maxLength={6}
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => {
            onPinChange(e.target.value.replace(/\D/g, ""));
            onPinErrorClear();
          }}
          placeholder="Enter 6-digit PIN"
          aria-label="Enter 6-digit PIN"
          aria-invalid={hasPinError}
          aria-describedby={hasPinError ? pinErrorId : undefined}
          className={`mt-6 w-full text-center rounded-xl border-2 border-gray-200 py-4 leading-none focus:border-gold focus:outline-none ${pin ? "text-2xl tracking-[0.5em]" : "text-sm tracking-normal"}`}
        />
        <input
          type="password"
          maxLength={6}
          inputMode="numeric"
          pattern="[0-9]*"
          value={confirmPin}
          onChange={(e) => onConfirmPinChange(e.target.value.replace(/\D/g, ""))}
          placeholder="Confirm PIN"
          aria-label="Confirm PIN"
          aria-invalid={hasPinError}
          aria-describedby={hasPinError ? pinErrorId : undefined}
          className={`mt-3 w-full text-center rounded-xl border-2 border-gray-200 py-4 leading-none focus:border-gold focus:outline-none ${confirmPin ? "text-2xl tracking-[0.5em]" : "text-sm tracking-normal"}`}
        />
        <button
          onClick={onCreatePin}
          disabled={pin.length !== 6 || confirmPin.length !== 6}
          className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create PIN
        </button>
      </div>
    );
  }

  // Enter PIN screen
  return (
    <div className="max-w-sm mx-auto py-16 text-center">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center">
          <span className="text-3xl">🔐</span>
        </div>
      </div>
      <h1 className="mt-6 text-xl font-bold text-navy">Enter Your Vault PIN</h1>
      {hasPinError && (
        <p id={pinErrorId} className="mt-3 text-sm text-red-600" role="alert">
          {pinError}
        </p>
      )}
      <input
        type="password"
        maxLength={6}
        inputMode="numeric"
        pattern="[0-9]*"
        value={pin}
        onChange={(e) => {
          onPinChange(e.target.value.replace(/\D/g, ""));
          onPinErrorClear();
        }}
        placeholder="6-digit PIN"
        aria-label="6-digit PIN"
        aria-invalid={hasPinError}
        aria-describedby={hasPinError ? pinErrorId : undefined}
        className={`mt-6 w-full text-center rounded-xl border-2 border-gray-200 py-4 leading-none focus:border-gold focus:outline-none ${pin ? "text-2xl tracking-[0.5em]" : "text-sm tracking-normal"}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && pin.length === 6) onVerifyPin();
        }}
      />
      <button
        onClick={onVerifyPin}
        disabled={pin.length !== 6}
        className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Unlock Vault
      </button>
    </div>
  );
}
