import crypto from "crypto";
import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

declare global {
  // eslint-disable-next-line no-var
  var __resetTokenStore: Map<string, number> | undefined;
}

const memStore: Map<string, number> =
  globalThis.__resetTokenStore || (globalThis.__resetTokenStore = new Map());

const TTL_SECONDS = 3600;

/** One place builds the key, so the writer and the reader cannot drift apart. */
const claimKey = (h: string) => `rstclaim:${h}`;

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function claimResetToken(tokenHash: string): Promise<boolean> {
  const h = hash(tokenHash);
  const key = claimKey(h);

  if (redis) {
    const set = await redis.set(key, "1", { nx: true, ex: TTL_SECONDS });
    return set === "OK";
  }

  const existing = memStore.get(h);
  if (existing && existing > Date.now()) return false;
  memStore.set(h, Date.now() + TTL_SECONDS * 1000);
  return true;
}

/**
 * Whether this link has already been exchanged successfully.
 *
 * Read-only: it lets the exchange route tell "you already used this link" apart
 * from "this link is invalid or expired" without marking anything as used.
 */
export async function isResetTokenClaimed(tokenHash: string): Promise<boolean> {
  const h = hash(tokenHash);

  if (redis) {
    return (await redis.exists(claimKey(h))) === 1;
  }

  const existing = memStore.get(h);
  return !!existing && existing > Date.now();
}
