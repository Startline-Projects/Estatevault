// Core Rule 4 — hard stops. Three situations must halt document generation and
// route the family to a licensed attorney. This is the single source of truth,
// used by the intake pages, the checkout route, the quiz personalization route
// and the Stripe webhook. Hardcoded, no override (a client flag can never
// relax it).

export type HardStopResult = {
  halted: boolean;
  reasons: string[];
};

/**
 * The canonical reason strings. Every caller reports a hard stop using one of
 * these — the quiz route used to have its own parallel vocabulary
 * ("special_needs_dependent", "special_needs_family_member"), so the same
 * situation was named differently depending on which door the client came in.
 */
export const HARD_STOP_REASONS = {
  specialNeeds: "Special-needs dependent",
  medicaid: "Medicaid planning",
  estateDispute: "Active estate dispute",
} as const;

export type HardStopReason = (typeof HARD_STOP_REASONS)[keyof typeof HARD_STOP_REASONS];

/**
 * Re-derive hard stops from raw intake answers. Accepts the will/trust intake
 * shape, the legacy marketing-quiz answer keys, and the snake_case shape the
 * webhook reads back off the order, so every entry point is covered regardless
 * of where the answers came from.
 */
export function evaluateHardStop(
  intake: Record<string, unknown> | null | undefined,
): HardStopResult {
  const reasons: string[] = [];
  if (!intake) return { halted: false, reasons };

  const yes = (...keys: string[]) =>
    keys.some((k) => {
      const v = intake[k];
      return typeof v === "string" && v.trim().toLowerCase() === "yes";
    });

  // 1. Special-needs dependent. Three input shapes: the will/trust question,
  //    the legacy quiz question (B2), and the legacy quiz free-choice (G1).
  if (
    yes("hasSpecialNeedsDependent", "has_special_needs_dependent", "specialNeedsChildren") ||
    intake.additionalSituation === "I have a family member with special needs"
  ) {
    reasons.push(HARD_STOP_REASONS.specialNeeds);
  }

  // (Irrevocable trust was a hard stop until 2026-09-18, when the founder
  // removed it: the questionnaire no longer asks, and an answer left on an old
  // order — wantsIrrevocableTrust / wants_irrevocable_trust / irrevocableTrust —
  // is deliberately ignored, so a webhook replay cannot halt on a stop that no
  // longer exists. Do not restore the branch; see CLAUDE.md, Core Rule 4.)

  // 2. Medicaid planning. Transfer timing and look-back rules change what the
  //    documents should say; generating from a questionnaire could cost the
  //    client their eligibility.
  if (yes("hasMedicaidPlanning", "has_medicaid_planning", "medicaidPlanning")) {
    reasons.push(HARD_STOP_REASONS.medicaid);
  }

  // 3. Active estate dispute. A contested estate is litigation, not document
  //    preparation.
  if (yes("hasEstateDispute", "has_estate_dispute", "estateDispute")) {
    reasons.push(HARD_STOP_REASONS.estateDispute);
  }

  const unique = Array.from(new Set(reasons));
  return { halted: unique.length > 0, reasons: unique };
}

/**
 * Quiz-route shim: the first reason, or null. The marketing quiz reports a
 * single reason in its JSON response rather than a list.
 *
 * Replaces the old detectQuizHardStop in lib/validation/schemas.ts, which was a
 * second, divergent evaluator that knew nothing about the will/trust intake
 * shape or the three triggers added here.
 */
export function firstHardStopReason(
  intake: Record<string, unknown> | null | undefined,
): string | null {
  const { reasons } = evaluateHardStop(intake);
  return reasons[0] ?? null;
}
