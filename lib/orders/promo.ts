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

/**
 * The app_settings row that switches test-kind codes on and off. Both places
 * that read it name it through this constant so they cannot drift apart.
 */
export const TEST_PROMO_SWITCH_KEY = "test_promo_code";

/**
 * Test-kind codes may only be redeemed from the platform's own pages. This
 * check used to live inline in the charger; the validator now asks the same
 * question, so the two cannot disagree about where a test order may come from.
 *
 * The host is parsed and compared, not searched for. The original test was
 * `origin.includes("estatevault.us")`, which https://estatevault.us.evil.example
 * and https://evil.example/?ref=estatevault.us both satisfied.
 */
export function isTrustedPromoOrigin(request: Request): boolean {
  const raw = request.headers.get("origin") || request.headers.get("referer") || "";
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/\.$/, ""); // "estatevault.us." is the same host
  } catch {
    return false; // absent or unparseable
  }
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) return true;
  return host === "estatevault.us" || host.endsWith(".estatevault.us");
}

export type PromoRefusal = "unknown_code" | "untrusted_origin" | "test_switch_off";

export type PromoDecision =
  | { accepted: true; kind: PromoKind }
  | { accepted: false; kind: PromoKind | null; refusal: PromoRefusal };

/**
 * The one answer to "will the charger honour this code right now?".
 *
 * The checkout page asks it before the client commits (POST
 * /api/checkout/validate-promo) and createCheckoutSession asks it again when
 * the order is placed. Both must reach the same verdict from the same inputs,
 * or the page tells a client a code works and the charge then ignores it — or
 * the reverse. The validator used to keep its own hardcoded list and did
 * exactly that.
 *
 * A free code is honoured whenever it is configured. A test code additionally
 * needs the request to come from a trusted origin and the admin switch
 * (app_settings.test_promo_code.active) to be on. The caller supplies both
 * facts so this stays pure and each caller keeps its own I/O.
 */
export function promoDecision(
  code: string | null | undefined,
  ctx: { testSwitchOn: boolean; trustedOrigin: boolean },
): PromoDecision {
  const kind = promoKind(code);
  if (kind === null) return { accepted: false, kind, refusal: "unknown_code" };
  if (kind === "free") return { accepted: true, kind };
  if (!ctx.trustedOrigin) return { accepted: false, kind, refusal: "untrusted_origin" };
  if (!ctx.testSwitchOn) return { accepted: false, kind, refusal: "test_switch_off" };
  return { accepted: true, kind };
}
