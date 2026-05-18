import crypto from "crypto";

type Entry = {
  // Legacy OTP fields (still supported)
  codeHash?: string;
  attempts: number;

  // Link-based verification
  linkHash?: string;
  sessionHash?: string;

  expiresAt: number;
  verifiedToken?: string;
  verifiedExpiresAt?: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __emailVerificationStore: Map<string, Entry> | undefined;
}

const store: Map<string, Entry> =
  globalThis.__emailVerificationStore || (globalThis.__emailVerificationStore = new Map());

const CODE_TTL_MS = 30 * 60 * 1000;
const VERIFIED_TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function purge(): void {
  const now = Date.now();
  const toDelete: string[] = [];
  store.forEach((entry, email) => {
    const codeExpired = entry.expiresAt < now;
    const tokenExpired = !entry.verifiedExpiresAt || entry.verifiedExpiresAt < now;
    if (codeExpired && tokenExpired) toDelete.push(email);
  });
  toDelete.forEach((k) => store.delete(k));
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function storeCode(email: string, code: string): void {
  purge();
  const e = normalize(email);
  store.set(e, {
    codeHash: hash(code),
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });
}

export function verifyCode(
  email: string,
  code: string
): { ok: true; token: string } | { ok: false; reason: "expired" | "invalid" | "too_many" | "not_requested" } {
  const e = normalize(email);
  const entry = store.get(e);
  if (!entry?.codeHash) return { ok: false, reason: "not_requested" };
  if (entry.expiresAt < Date.now()) {
    store.delete(e);
    return { ok: false, reason: "expired" };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many" };
  }
  entry.attempts += 1;
  if (entry.codeHash !== hash(code)) {
    return { ok: false, reason: "invalid" };
  }
  const token = crypto.randomBytes(24).toString("base64url");
  entry.verifiedToken = token;
  entry.verifiedExpiresAt = Date.now() + VERIFIED_TTL_MS;
  entry.expiresAt = 0;
  return { ok: true, token };
}

// ── Link-based verification ────────────────────────────────────────────

export function generateUrlToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function storeLink(email: string, linkToken: string, sessionId: string): void {
  purge();
  const e = normalize(email);
  store.set(e, {
    linkHash: hash(linkToken),
    sessionHash: hash(sessionId),
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
  });
}

export function redeemLink(
  email: string,
  linkToken: string
): { ok: true } | { ok: false; reason: "expired" | "invalid" | "not_requested" | "already_used" } {
  const e = normalize(email);
  const entry = store.get(e);
  if (!entry?.linkHash) return { ok: false, reason: "not_requested" };
  if (entry.verifiedToken) return { ok: false, reason: "already_used" };
  if (entry.expiresAt < Date.now()) {
    store.delete(e);
    return { ok: false, reason: "expired" };
  }
  if (entry.linkHash !== hash(linkToken)) {
    return { ok: false, reason: "invalid" };
  }
  entry.verifiedToken = crypto.randomBytes(24).toString("base64url");
  entry.verifiedExpiresAt = Date.now() + VERIFIED_TTL_MS;
  return { ok: true };
}

export function pollLink(email: string, sessionId: string): string | null {
  const e = normalize(email);
  const entry = store.get(e);
  if (!entry?.sessionHash) return null;
  if (entry.sessionHash !== hash(sessionId)) return null;
  if (!entry.verifiedToken || !entry.verifiedExpiresAt) return null;
  if (entry.verifiedExpiresAt < Date.now()) return null;
  return entry.verifiedToken;
}

export function consumeVerifiedToken(email: string, token: string): boolean {
  const e = normalize(email);
  const entry = store.get(e);
  if (!entry?.verifiedToken || !entry.verifiedExpiresAt) return false;
  if (entry.verifiedExpiresAt < Date.now()) {
    store.delete(e);
    return false;
  }
  if (entry.verifiedToken !== token) return false;
  store.delete(e);
  return true;
}
