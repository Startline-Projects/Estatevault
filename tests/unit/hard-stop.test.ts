import { describe, it, expect } from "vitest";
import { evaluateHardStop } from "@/lib/compliance/hardStop";

describe("evaluateHardStop — Core Rule 4", () => {
  it("passes when no special-needs signal present", () => {
    expect(evaluateHardStop({ firstName: "A", hasMinorChildren: "Yes" })).toEqual({
      halted: false,
      reasons: [],
    });
  });

  it("halts on the new intake field", () => {
    const r = evaluateHardStop({ hasSpecialNeedsDependent: "Yes" });
    expect(r.halted).toBe(true);
    expect(r.reasons).toEqual(["Special-needs dependent"]);
  });

  it("is case/whitespace tolerant on Yes", () => {
    expect(evaluateHardStop({ hasSpecialNeedsDependent: " yes " }).halted).toBe(true);
  });

  it("does not halt on No", () => {
    expect(evaluateHardStop({ hasSpecialNeedsDependent: "No" }).halted).toBe(false);
  });

  it("halts on the legacy quiz B2 answer", () => {
    expect(evaluateHardStop({ specialNeedsChildren: "Yes" }).halted).toBe(true);
  });

  it("halts on the legacy quiz G1 additionalSituation answer", () => {
    expect(
      evaluateHardStop({
        additionalSituation: "I have a family member with special needs",
      }).halted,
    ).toBe(true);
  });

  it("dedupes reasons when multiple signals fire", () => {
    const r = evaluateHardStop({
      hasSpecialNeedsDependent: "Yes",
      specialNeedsChildren: "Yes",
    });
    expect(r.reasons).toEqual(["Special-needs dependent"]);
  });

  it("handles null/undefined intake", () => {
    expect(evaluateHardStop(null).halted).toBe(false);
    expect(evaluateHardStop(undefined).halted).toBe(false);
  });
});
