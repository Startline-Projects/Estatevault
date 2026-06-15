import crypto from "crypto";
import { Redis } from "@upstash/redis";

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

// M-6: verification state must be shared across serverless instances. Use
// Upstash Redis when configured; fall back to an in-process Map for local dev
// / tests (single instance, so correctness holds there).
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

declare global {
  // eslint-disable-next-line no-var
  var __emailVerificationStore: Map<string, Entry> | undefined;
}

const memStore: Map<string, Entry> =
  globalThis.__emailVerificationStore || (globalThis.__emailVerificationStore = new Map());

const CODE_TTL_MS = 30 * 60 * 1000;
const VERIFIED_TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;
// Redis row TTL — long enough to cover both the code window and the verified
// token window; the in-value timestamps still gate exact expiry.
const ROW_TTL_SECONDS = 60 * 60;

function redisKey(email: string): string {
  return `emailverify:${email}`;
}

async function getEntry(email: string): Promise<Entry | null> {
  if (redis) return (await redis.get<Entry>(redisKey(email))) ?? null;
  return memStore.get(email) ?? null;
}

async function setEntry(email: string, entry: Entry): Promise<void> {
  if (redis) {
    await redis.set(redisKey(email), entry, { ex: ROW_TTL_SECONDS });
    return;
  }
  memStore.set(email, entry);
}

async function delEntry(email: string): Promise<void> {
  if (redis) {
    await redis.del(redisKey(email));
    return;
  }
  memStore.delete(email);
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeCode(email: string, code: string): Promise<void> {
  const e = normalize(email);
  const existing = await getEntry(e);
  const carriedAttempts = existing ? Math.max(0, existing.attempts - 2) : 0;
  await setEntry(e, {
    codeHash: hash(code),
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: carriedAttempts,
  });
}

export async function verifyCode(
  email: string,
  code: string,
): Promise<{ ok: true; token: string } | { ok: false; reason: "expired" | "invalid" | "too_many" | "not_requested" }> {
  const e = normalize(email);
  const entry = await getEntry(e);
  if (!entry?.codeHash) return { ok: false, reason: "not_requested" };
  if (entry.expiresAt < Date.now()) {
    await delEntry(e);
    return { ok: false, reason: "expired" };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many" };
  }
  entry.attempts += 1;
  if (entry.codeHash !== hash(code)) {
    await setEntry(e, entry);
    return { ok: false, reason: "invalid" };
  }
  const token = crypto.randomBytes(24).toString("base64url");
  entry.verifiedToken = token;
  entry.verifiedExpiresAt = Date.now() + VERIFIED_TTL_MS;
  entry.expiresAt = 0;
  await setEntry(e, entry);
  return { ok: true, token };
}

// ── Link-based verification ────────────────────────────────────────────

export function generateUrlToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function storeLink(email: string, linkToken: string, sessionId: string): Promise<void> {
  await setEntry(normalize(email), {
    linkHash: hash(linkToken),
    sessionHash: hash(sessionId),
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
  });
}

export async function redeemLink(
  email: string,
  linkToken: string,
): Promise<{ ok: true } | { ok: false; reason: "expired" | "invalid" | "not_requested" | "already_used" }> {
  const e = normalize(email);
  const entry = await getEntry(e);
  if (!entry?.linkHash) return { ok: false, reason: "not_requested" };
  if (entry.verifiedToken) return { ok: false, reason: "already_used" };
  if (entry.expiresAt < Date.now()) {
    await delEntry(e);
    return { ok: false, reason: "expired" };
  }
  if (entry.linkHash !== hash(linkToken)) {
    return { ok: false, reason: "invalid" };
  }
  entry.verifiedToken = crypto.randomBytes(24).toString("base64url");
  entry.verifiedExpiresAt = Date.now() + VERIFIED_TTL_MS;
  await setEntry(e, entry);
  return { ok: true };
}

export async function pollLink(email: string, sessionId: string): Promise<string | null> {
  const e = normalize(email);
  const entry = await getEntry(e);
  if (!entry?.sessionHash) return null;
  if (entry.sessionHash !== hash(sessionId)) return null;
  if (!entry.verifiedToken || !entry.verifiedExpiresAt) return null;
  if (entry.verifiedExpiresAt < Date.now()) return null;
  return entry.verifiedToken;
}

export async function consumeVerifiedToken(email: string, token: string): Promise<boolean> {
  const e = normalize(email);
  const entry = await getEntry(e);
  if (!entry?.verifiedToken || !entry.verifiedExpiresAt) return false;
  if (entry.verifiedExpiresAt < Date.now()) {
    await delEntry(e);
    return false;
  }
  if (entry.verifiedToken !== token) return false;
  await delEntry(e);
  return true;
}

// BUG-11: validate a verified token WITHOUT consuming it. Lets a caller (e.g.
// set-password) gate on a valid token but defer the single-use burn until the
// work actually succeeds, so a transient failure (auth create down) doesn't
// lock the paying customer out of a retry. Still purges expired tokens.
export async function peekVerifiedToken(email: string, token: string): Promise<boolean> {
  const e = normalize(email);
  const entry = await getEntry(e);
  if (!entry?.verifiedToken || !entry.verifiedExpiresAt) return false;
  if (entry.verifiedExpiresAt < Date.now()) {
    await delEntry(e);
    return false;
  }
  return entry.verifiedToken === token;
}
