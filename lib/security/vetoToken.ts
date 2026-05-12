/**
 * Owner-veto token — HMAC-signed, single-use, time-bound.
 * Format: base64url("{requestId}.{expiresAt}.{hmac}")
 *
 * Server signs at approval time, emails owner. Owner clicks link.
 * Endpoint verifies HMAC + expiry + that request still active.
 */
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = () => {
  const s = process.env.VETO_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error("VETO_TOKEN_SECRET must be set (>=32 chars)");
  return s;
};

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}
function fromB64url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET()).update(payload).digest("base64url");
}

export function issueVetoToken(requestId: string, ttlSeconds: number): string {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = `${requestId}.${expiresAt}`;
  const mac = sign(payload);
  return b64url(`${payload}.${mac}`);
}

export type VetoTokenResult =
  | { ok: true; requestId: string; expiresAt: number }
  | { ok: false; error: string };

export function verifyVetoToken(token: string): VetoTokenResult {
  let decoded: string;
  try { decoded = fromB64url(token); } catch { return { ok: false, error: "bad token" }; }
  const parts = decoded.split(".");
  if (parts.length !== 3) return { ok: false, error: "bad token shape" };
  const [requestId, expStr, macGiven] = parts;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt)) return { ok: false, error: "bad expiry" };
  if (Date.now() > expiresAt) return { ok: false, error: "expired" };

  const macExpected = sign(`${requestId}.${expiresAt}`);
  const a = Buffer.from(macGiven, "base64url");
  const b = Buffer.from(macExpected, "base64url");
  if (a.length !== b.length) return { ok: false, error: "bad mac" };
  if (!timingSafeEqual(a, b)) return { ok: false, error: "bad mac" };
  return { ok: true, requestId, expiresAt };
}
