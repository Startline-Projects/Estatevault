"use client";

// Copy + auto-clear after delay. For passphrase, mnemonic, recovery codes.
// 30 s default — long enough to paste into a password manager, short enough
// that walking away doesn't leak.

export async function copyAndScrub(value: string, delayMs = 30_000): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("clipboard unavailable");
  }
  await navigator.clipboard.writeText(value);
  setTimeout(() => {
    navigator.clipboard.writeText("").catch(() => undefined);
  }, delayMs);
}
