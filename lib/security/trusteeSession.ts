/**
 * Trustee session cookie — signed JWT-lite.
 * Issued at unlock-verify, carries request_id + client_id + trustee_id + expiry.
 * 30-minute lifetime, refreshed on each successful API call.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "ev_trustee_session";
export const SESSION_TTL_SECONDS = 30 * 60;

function secret(): string {
  const s = process.env.TRUSTEE_SESSION_SECRET || process.env.TRUSTEE_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error("TRUSTEE_SESSION_SECRET must be set (>=32 chars)");
  return s;
}

export interface TrusteeSession {
  requestId: string;
  clientId: string;
  trusteeId: string;
  trusteeEmail: string;
  expiresAt: number;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueSession(s: Omit<TrusteeSession, "expiresAt">): { value: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ ...s, expiresAt })).toString("base64url");
  const mac = sign(payload);
  return { value: `${payload}.${mac}`, expiresAt };
}

export function verifySession(value: string): TrusteeSession | null {
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, macGiven] = parts;
  const macExpected = sign(payload);
  const a = Buffer.from(macGiven, "base64url");
  const b = Buffer.from(macExpected, "base64url");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TrusteeSession;
    if (Date.now() > obj.expiresAt) return null;
    return obj;
  } catch { return null; }
}

export function requireTrusteeSession(): TrusteeSession | null {
  const c = cookies().get(SESSION_COOKIE);
  if (!c) return null;
  return verifySession(c.value);
}
