// Core Rule 4 — hard stops. A special-needs dependent must halt document
// generation and route the family to a licensed attorney. This is the single
// source of truth, used by the intake pages, the checkout route, and the
// Stripe webhook. Hardcoded, no override (a client flag can never relax it).
//
// Note: irrevocable-trust is intentionally NOT enforced here — the platform
// only ever generates a *revocable* trust, so there is no intake path that can
// produce one. See BUG-3. If an irrevocable-trust intake question is ever
// added, extend this predicate so all callers pick it up.

export type HardStopResult = {
  halted: boolean;
  reasons: string[];
};

/**
 * Re-derive hard stops from raw intake answers. Accepts both the new
 * will/trust intake shape (`hasSpecialNeedsDependent`) and the legacy quiz
 * answer keys (`specialNeedsChildren`, `additionalSituation`) so every entry
 * point is covered regardless of where the answers came from.
 */
export function evaluateHardStop(
  intake: Record<string, unknown> | null | undefined,
): HardStopResult {
  const reasons: string[] = [];
  if (!intake) return { halted: false, reasons };

  const yes = (v: unknown) =>
    typeof v === "string" && v.trim().toLowerCase() === "yes";

  // New will/trust intake question.
  if (yes(intake.hasSpecialNeedsDependent)) {
    reasons.push("Special-needs dependent");
  }

  // Legacy marketing-quiz answers (B2 / G1).
  if (yes(intake.specialNeedsChildren)) {
    reasons.push("Special-needs dependent");
  }
  if (
    typeof intake.additionalSituation === "string" &&
    intake.additionalSituation === "I have a family member with special needs"
  ) {
    reasons.push("Special-needs dependent");
  }

  const unique = Array.from(new Set(reasons));
  return { halted: unique.length > 0, reasons: unique };
}
