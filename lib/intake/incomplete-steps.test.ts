/**
 * Prompt 3B — in-flight session handling.
 *
 * A session saved before a required question existed must be routed back to the
 * step that asks it, with existing answers preserved, rather than failing
 * validation at checkout where the client cannot act on the error.
 */

import { describe, it, expect } from "vitest";
import { findResumePoint, isIntakeComplete, FLOW_REQUIREMENTS } from "./incomplete-steps";

/** What a will-flow session looked like before the POA/PAD steps existed. */
function preDeployWillSession(): Record<string, unknown> {
  return {
    firstName: "Ahmed",
    lastName: "Hassan",
    city: "Dearborn",
    state: "Michigan",
    maritalStatus: "Married",
    executorName: "Raga Hassan",
    executorRelationship: "Spouse/Partner",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "100", contingency: "descendants" }],
    beneficiariesEqualShares: "Yes",
    hasSpecificGifts: "No",
    organDonation: "Yes",
  };
}

/** A session saved after the deploy, with every question answered. */
function completeSession(): Record<string, unknown> {
  return {
    ...preDeployWillSession(),
    poaAgentName: "Raga Hassan",
    poaAgentRelationship: "Spouse/Partner",
    poaPowers: ["Banking and finances"],
    poaEffective: "immediate",
    patientAdvocateName: "Raga Hassan",
    patientAdvocateRelationship: "Spouse/Partner",
  };
}

describe("a pre-deploy session is redirected, not failed", () => {
  it("routes a session that predates the per-beneficiary contingency to the beneficiaries step first", () => {
    const old = {
      ...preDeployWillSession(),
      beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "100" }],
      hasContingentBeneficiary: "No",
    };
    const resume = findResumePoint("will", old);
    expect(resume).not.toBeNull();
    expect(resume!.step).toBe("beneficiaries");
    expect(resume!.missingFields).toContain("beneficiaries[].contingency");
  });

  it("sends a will session missing the POA answers back to the poa step", () => {
    const resume = findResumePoint("will", preDeployWillSession());
    expect(resume).not.toBeNull();
    expect(resume!.step).toBe("poa");
  });

  it("reports every missing field, not only the first", () => {
    const resume = findResumePoint("will", preDeployWillSession())!;
    expect(resume.missingFields).toEqual(
      expect.arrayContaining([
        "poaAgentName",
        "poaAgentRelationship",
        "poaEffective",
        "patientAdvocateName",
      ]),
    );
  });

  it("moves on to the healthcare step once the POA answers are supplied", () => {
    const partly = {
      ...preDeployWillSession(),
      poaAgentName: "Raga Hassan",
      poaAgentRelationship: "Spouse/Partner",
      poaPowers: ["Banking and finances"],
      poaEffective: "springing",
    };
    expect(findResumePoint("will", partly)!.step).toBe("healthcare");
  });

  it("lets a complete session through", () => {
    expect(findResumePoint("will", completeSession())).toBeNull();
    expect(isIntakeComplete("will", completeSession())).toBe(true);
  });

  it("applies the same rules to the trust flow", () => {
    expect(findResumePoint("trust", preDeployWillSession())!.step).toBe("poa");
    expect(isIntakeComplete("trust", completeSession())).toBe(true);
  });

  it("treats blank strings and empty arrays as unanswered", () => {
    const blanks = { ...completeSession(), poaEffective: "   ", poaPowers: [] };
    const resume = findResumePoint("will", blanks)!;
    expect(resume.missingFields).toContain("poaEffective");
    expect(resume.missingFields).toContain("poaPowers");
  });

  it("handles a null intake without throwing", () => {
    expect(findResumePoint("will", null)).toBeNull();
    expect(findResumePoint("will", undefined)).toBeNull();
  });
});

describe("the mechanism is generic enough for later questions", () => {
  it("describes each requirement as field + step + predicate", () => {
    for (const flow of ["will", "trust"] as const) {
      for (const r of FLOW_REQUIREMENTS[flow]) {
        expect(typeof r.field).toBe("string");
        expect(typeof r.step).toBe("string");
        expect(typeof r.isAnswered).toBe("function");
      }
    }
  });

  it("routes to the step of the first unmet requirement in declaration order", () => {
    // Prompt 8 will add per-beneficiary contingency requirements on the
    // beneficiaries step; ordering must keep the client moving forward.
    const steps = FLOW_REQUIREMENTS.will.map((r) => r.step);
    expect(steps.indexOf("poa")).toBeLessThan(steps.indexOf("healthcare"));
  });
});
