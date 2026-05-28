// KeySession — lifecycle of MK in worker. Idle lock + visibility lock + activity tracking.
// Main thread holds NO key material; only state ("locked"/"unlocked") and timers.
"use client";

import { getCryptoWorker, terminateCryptoWorker } from "./worker/client";
import type { LockState } from "./worker/types";

const IDLE_MS = 15 * 60 * 1000;       // 15 min idle → lock
const HIDDEN_GRACE_MS = 5 * 60 * 1000; // 5 min hidden → lock
const ACTIVITY_EVENTS = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"];
const SESSION_MK_KEY = "vault:session-mk";

import { b64encode as bytesToB64, b64decode as b64ToBytes } from "./encoding";

type Listener = (s: LockState) => void;

class KeySessionImpl {
  private state: LockState = "locked";
  private listeners = new Set<Listener>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private activityBound = false;
  private visibilityBound = false;
  private restorePromise: Promise<boolean> | null = null;

  getState(): LockState { return this.state; }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(s: LockState) {
    if (this.state === s) return;
    this.state = s;
    this.listeners.forEach(l => l(s));
  }

  private bindActivity() {
    if (this.activityBound || typeof window === "undefined") return;
    const reset = () => this.resetIdle();
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, reset, { passive: true });
    this.activityBound = true;
  }

  private bindVisibility() {
    if (this.visibilityBound || typeof document === "undefined") return;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.hiddenTimer = setTimeout(() => this.lock(), HIDDEN_GRACE_MS);
      } else {
        if (this.hiddenTimer) { clearTimeout(this.hiddenTimer); this.hiddenTimer = null; }
        this.resetIdle();
      }
    });
    this.visibilityBound = true;
  }

  private resetIdle() {
    if (this.state !== "unlocked") return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.lock(), IDLE_MS);
  }

  private startTimers() {
    this.bindActivity();
    this.bindVisibility();
    this.resetIdle();
  }

  private stopTimers() {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    if (this.hiddenTimer) { clearTimeout(this.hiddenTimer); this.hiddenTimer = null; }
  }

  private async persistSessionMk() {
    if (typeof window === "undefined") return;
    try {
      const w = getCryptoWorker();
      const raw = await w.exportMkForSession();
      sessionStorage.setItem(SESSION_MK_KEY, bytesToB64(raw));
    } catch { /* best-effort */ }
  }

  private clearSessionMk() {
    if (typeof window === "undefined") return;
    try { sessionStorage.removeItem(SESSION_MK_KEY); } catch { /* ignore */ }
  }

  // Restore MK from sessionStorage (set after a successful unlock). Idempotent;
  // safe to call repeatedly. Caller should await this on mount before showing
  // the unlock modal so reloads don't bounce users to passphrase entry.
  async tryRestoreFromSession(): Promise<boolean> {
    if (this.state === "unlocked") return true;
    if (typeof window === "undefined") return false;
    if (this.restorePromise) return this.restorePromise;
    const b64 = sessionStorage.getItem(SESSION_MK_KEY);
    if (!b64) return false;
    this.restorePromise = (async () => {
      try {
        const raw = b64ToBytes(b64);
        const w = getCryptoWorker();
        await w.unlockWithRawMk(raw);
        this.setState("unlocked");
        this.startTimers();
        return true;
      } catch {
        this.clearSessionMk();
        return false;
      } finally {
        this.restorePromise = null;
      }
    })();
    return this.restorePromise;
  }

  async unlockWithPassphrase(args: Parameters<Awaited<ReturnType<typeof getCryptoWorker>>["unlockWithPassphrase"]>[0]) {
    const w = getCryptoWorker();
    await w.unlockWithPassphrase(args);
    this.setState("unlocked");
    this.startTimers();
    await this.persistSessionMk();
  }

  async unlockWithMnemonic(args: { mnemonic: string; wrappedMkRecovery: Uint8Array }) {
    const w = getCryptoWorker();
    await w.unlockWithMnemonic(args);
    this.setState("unlocked");
    this.startTimers();
    await this.persistSessionMk();
  }

  async bootstrap(args: { passphrase: string }) {
    const w = getCryptoWorker();
    const out = await w.bootstrap(args);
    this.setState("unlocked");
    this.startTimers();
    await this.persistSessionMk();
    return out;
  }

  async lock() {
    this.stopTimers();
    this.clearSessionMk();
    try {
      const w = getCryptoWorker();
      await w.lock();
    } catch { /* worker may already be gone */ }
    this.setState("locked");
  }

  // Hard reset — terminate worker entirely (called on logout).
  async destroy() {
    this.stopTimers();
    this.clearSessionMk();
    terminateCryptoWorker();
    this.setState("locked");
  }
}

let session: KeySessionImpl | null = null;
export function getKeySession(): KeySessionImpl {
  if (!session) session = new KeySessionImpl();
  return session;
}

// Kick off restore as soon as module loads on the client so navigations after
// the very first paint already see "unlocked" state.
if (typeof window !== "undefined") {
  // Fire-and-forget — internal state listeners flip subscribers once it lands.
  void getKeySession().tryRestoreFromSession();
}
export type KeySession = KeySessionImpl;
