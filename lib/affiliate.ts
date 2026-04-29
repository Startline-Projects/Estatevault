import { randomBytes, createHash } from "crypto";

export const AFFILIATE_COOKIE = "ev_aff";
export const AFFILIATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days in seconds

const BASE32_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // Crockford-ish, drops I,L,O,U,0,1

export function generateAffiliateCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return out;
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Lightweight affiliate row shape returned by lookups.
 */
export type AffiliateLookup = {
  id: string;
  status: string;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
};
