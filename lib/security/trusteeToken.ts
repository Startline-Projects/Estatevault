/**
 * Trustee access token + OTP code helpers.
 *
 * Token: HMAC-signed (TRUSTEE_TOKEN_SECRET), bound to request_id + trustee_email.
 * Stored on row as sha256 hash. One-time use enforced by clearing hash on success.
 *
 * OTP: 6-digit numeric. Stored hashed with trustee_id salt.
 */
import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";

const SECRET = () => {
  const s = process.env.TRUSTEE_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error("TRUSTEE_TOKEN_SECRET must be set (>=32 chars)");
  return s;
};

export function hashToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

export function issueTrusteeToken(requestId: string, trusteeEmail: string, ttlSeconds: number): string {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = `${requestId}.${trusteeEmail.toLowerCase()}.${expiresAt}`;
  const mac = createHmac("sha256", SECRET()).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${mac}`).toString("base64url");
}

export type VerifyResult =
  | { ok: true; requestId: string; trusteeEmail: string; expiresAt: number }
  | { ok: false; error: string };

export function verifyTrusteeToken(token: string): VerifyResult {
  let decoded: string;
  try { decoded = Buffer.from(token, "base64url").toString("utf8"); }
  catch { return { ok: false, error: "bad token" }; }
  const parts = decoded.split(".");
  if (parts.length !== 4) return { ok: false, error: "bad shape" };
  const [requestId, trusteeEmail, expStr, macGiven] = parts;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt)) return { ok: false, error: "bad expiry" };
  if (Date.now() > expiresAt) return { ok: false, error: "expired" };

  const macExpected = createHmac("sha256", SECRET())
    .update(`${requestId}.${trusteeEmail}.${expiresAt}`)
    .digest("base64url");
  const a = Buffer.from(macGiven, "base64url");
  const b = Buffer.from(macExpected, "base64url");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "bad mac" };
  return { ok: true, requestId, trusteeEmail, expiresAt };
}

// 6-digit OTP code, cryptographically random.
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Hash OTP for at-rest storage. Includes pepper from secret so DB leak alone can't precompute.
export function hashOtp(code: string, salt: string): string {
  return createHash("sha256").update(`${SECRET()}|${salt}|${code}`).digest("hex");
}
