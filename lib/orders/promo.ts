/**
 * Promo codes.
 *
 * These used to be a hardcoded, always-active object in the source. Anyone who
 * read the repo — or guessed — could take a free Will or Trust package forever,
 * and there was no way to turn a code off without a deploy.
 *
 * They now come from configuration and default to NONE. A code only exists if
 * an operator put it in the PROMO_CODES environment variable, which means the
 * safe state (no promos) is also the default state.
 *
 * Format: comma-separated CODE:kind pairs, e.g.
 *   PROMO_CODES="LAUNCH24:free,SMOKE:test"
 *
 * kind = "free" — order total becomes 0, documents generate, no Stripe session.
 * kind = "test" — Stripe runs in test mode for that order.
 */

export type PromoKind = "free" | "test";

const VALID_KINDS: readonly string[] = ["free", "test"];

/** Parsed on each call so a platform restart is enough to change the set. */
export function getPromoCodes(): Record<string, PromoKind> {
  const raw = process.env.PROMO_CODES;
  if (!raw || !raw.trim()) return {};

  const out: Record<string, PromoKind> = {};
  for (const pair of raw.split(",")) {
    const [code, kind] = pair.split(":").map((p) => (p ?? "").trim());
    if (!code || !VALID_KINDS.includes(kind)) {
      // A malformed entry is dropped rather than guessed at: a typo must not
      // silently become a working free-order code.
      if (code) console.warn(`[promo] ignoring malformed entry for "${code}"`);
      continue;
    }
    out[code.toUpperCase()] = kind as PromoKind;
  }
  return out;
}

/** The kind of a supplied code, or null when it is not an enabled code. */
export function promoKind(code: string | null | undefined): PromoKind | null {
  if (!code || !code.trim()) return null;
  return getPromoCodes()[code.trim().toUpperCase()] ?? null;
}

/** True when the code is enabled, of any kind. */
export function isPromoEnabled(code: string | null | undefined): boolean {
  return promoKind(code) !== null;
}
