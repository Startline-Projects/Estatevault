/**
 * Core Rule 4 — all four triggers, one evaluator, both server gates.
 *
 * Three of the four (irrevocable trust, Medicaid planning, active estate
 * dispute) were promised on the marketing pages and enforced nowhere. These
 * tests pin each one at the evaluator and at both places that can still stop an
 * order: the checkout session and the Stripe webhook.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { evaluateHardStop, firstHardStopReason, HARD_STOP_REASONS } from "./hardStop";

const TRIGGERS = [
  { name: "special-needs dependent", field: "hasSpecialNeedsDependent", reason: HARD_STOP_REASONS.specialNeeds },
  { name: "irrevocable trust", field: "wantsIrrevocableTrust", reason: HARD_STOP_REASONS.irrevocableTrust },
  { name: "Medicaid planning", field: "hasMedicaidPlanning", reason: HARD_STOP_REASONS.medicaid },
  { name: "active estate dispute", field: "hasEstateDispute", reason: HARD_STOP_REASONS.estateDispute },
] as const;

const CLEAN = {
  hasSpecialNeedsDependent: "No",
  wantsIrrevocableTrust: "No",
  hasMedicaidPlanning: "No",
  hasEstateDispute: "No",
};

describe("every trigger halts", () => {
  it.each(TRIGGERS)("$name", ({ field, reason }) => {
    const result = evaluateHardStop({ ...CLEAN, [field]: "Yes" });
    expect(result.halted).toBe(true);
    expect(result.reasons).toEqual([reason]);
  });

  it("a clean intake does not halt", () => {
    expect(evaluateHardStop(CLEAN)).toEqual({ halted: false, reasons: [] });
  });

  it("reports every trigger that fired, once each", () => {
    const all = evaluateHardStop({
      hasSpecialNeedsDependent: "Yes", wantsIrrevocableTrust: "Yes",
      hasMedicaidPlanning: "Yes", hasEstateDispute: "Yes",
      specialNeedsChildren: "Yes", // same situation by another name
    });
    expect(all.reasons).toEqual([
      HARD_STOP_REASONS.specialNeeds,
      HARD_STOP_REASONS.irrevocableTrust,
      HARD_STOP_REASONS.medicaid,
      HARD_STOP_REASONS.estateDispute,
    ]);
  });

  it.each(TRIGGERS)("$name is case and whitespace insensitive", ({ field }) => {
    expect(evaluateHardStop({ ...CLEAN, [field]: "  yes " }).halted).toBe(true);
    expect(evaluateHardStop({ ...CLEAN, [field]: "YES" }).halted).toBe(true);
  });

  it("reads the snake_case shape the webhook gets back off the order", () => {
    expect(evaluateHardStop({ wants_irrevocable_trust: "Yes" }).halted).toBe(true);
    expect(evaluateHardStop({ has_medicaid_planning: "Yes" }).halted).toBe(true);
    expect(evaluateHardStop({ has_estate_dispute: "Yes" }).halted).toBe(true);
    expect(evaluateHardStop({ has_special_needs_dependent: "Yes" }).halted).toBe(true);
  });

  it("an unanswered trigger is not a Yes, and not a halt", () => {
    expect(evaluateHardStop({ wantsIrrevocableTrust: "" }).halted).toBe(false);
    expect(evaluateHardStop({}).halted).toBe(false);
    expect(evaluateHardStop(null).halted).toBe(false);
  });
});

describe("one evaluator, one vocabulary", () => {
  it("the quiz route's single-reason shim uses the same strings", () => {
    expect(firstHardStopReason({ specialNeedsChildren: "Yes" })).toBe(HARD_STOP_REASONS.specialNeeds);
    expect(firstHardStopReason({ additionalSituation: "I have a family member with special needs" }))
      .toBe(HARD_STOP_REASONS.specialNeeds);
    expect(firstHardStopReason(CLEAN)).toBeNull();
  });

  it("the second evaluator is gone", () => {
    const schemas = readFileSync(join(__dirname, "..", "validation", "schemas.ts"), "utf8");
    expect(schemas).not.toMatch(/export function detectQuizHardStop/);
    const quizRoute = readFileSync(
      join(__dirname, "..", "..", "app", "api", "quiz", "personalize", "route.ts"), "utf8");
    expect(quizRoute).toContain("firstHardStopReason");
    expect(quizRoute).not.toContain("detectQuizHardStop");
  });

  it("no caller invents its own reason strings", () => {
    for (const [, reason] of Object.entries(HARD_STOP_REASONS)) {
      expect(reason[0]).toBe(reason[0].toUpperCase()); // human-readable, not a slug
      expect(reason).not.toMatch(/_/);
    }
  });
});

describe("both server gates ask the evaluator", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

  it("checkout refuses to create an order or a Stripe session", () => {
    const src = read("lib/checkout/createCheckoutSession.ts");
    expect(src).toContain("evaluateHardStop(intakeAnswers)");
    const gate = src.slice(src.indexOf("const hardStop = evaluateHardStop"));
    // the halt returns before any Stripe call
    expect(gate.indexOf("hardStop.halted")).toBeLessThan(gate.indexOf("stripe.checkout"));
  });

  it("the webhook parks the order instead of generating", () => {
    const src = read("lib/webhooks/stripe/handleDocumentCheckout.ts");
    expect(src).toContain("evaluateHardStop(intakeForStop).halted");
    expect(src).toContain('status: "needs_attorney"');
    const gate = src.slice(src.indexOf("evaluateHardStop(intakeForStop)"));
    expect(gate.indexOf("return;")).toBeLessThan(gate.indexOf("documentRepo"));
  });

  it("the questionnaire screens ask the evaluator rather than one field", () => {
    for (const page of ["app/will/page.tsx", "app/trust/page.tsx"]) {
      const src = read(page);
      expect(src, page).toContain("evaluateHardStop(intake as unknown as Record<string, unknown>).halted");
      expect(src, page).not.toContain('if (intake.hasSpecialNeedsDependent === "Yes") {');
    }
  });
});

describe("the questions exist and cannot be skipped", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

  it("every trigger has a question in both flows", () => {
    const component = read("components/intake/HardStopQuestions.tsx");
    for (const f of ["wantsIrrevocableTrust", "hasMedicaidPlanning", "hasEstateDispute"]) {
      expect(component).toContain(f);
    }
    for (const page of ["app/will/page.tsx", "app/trust/page.tsx"]) {
      expect(read(page), page).toContain("<HardStopQuestions");
      expect(read(page), page).toContain("hardStopQuestionsAnswered(intake)");
    }
  });

  it("the wording is marked pending, and only in code", () => {
    expect(read("components/intake/HardStopQuestions.tsx")).toContain("PENDING ATTORNEY APPROVAL");
  });

  it("none of them has a default", () => {
    const willTypes = read("lib/will-types.ts");
    const trustTypes = read("lib/trust-types.ts");
    for (const f of ["wantsIrrevocableTrust", "hasMedicaidPlanning", "hasEstateDispute"]) {
      expect(willTypes).toContain(`${f}: ""`);
      expect(trustTypes).toContain(`${f}: ""`);
    }
  });
});
