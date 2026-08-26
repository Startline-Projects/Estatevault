/**
 * Prompt 3B — a will order generates ["will", "poa", "healthcare_directive"],
 * but the will questionnaire used to collect no POA or patient-advocate answers
 * at all. Under strict mode every will order would have been held.
 *
 * These tests use the answers a will-flow client now produces and assert that
 * all three documents render.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mapIntakeToTemplateData, validateForDocument } from "./intake-adapter";

const ORIGINAL_FLAG = process.env.PDF_RENDERER;

/** Exactly what app/will/page.tsx now saves at checkout. */
function willFlowAnswers(): Record<string, unknown> {
  return {
    firstName: "Ahmed",
    lastName: "Hassan",
    dateOfBirth: "1975-01-15",
    city: "Dearborn",
    state: "Michigan",
    maritalStatus: "Married",
    hasMinorChildren: "No",
    executorName: "Raga Hassan",
    executorRelationship: "Spouse/Partner",
    successorExecutorName: "Karim Hassan",
    successorExecutorRelationship: "Sibling",
    beneficiaries: [
      { name: "Layla Hassan", relationship: "Child", share: "", contingency: "other_beneficiaries" },
      { name: "Omar Hassan", relationship: "Child", share: "", contingency: "other_beneficiaries" },
    ],
    beneficiariesEqualShares: "Yes",
    hasContingentBeneficiary: "No",
    contingentBeneficiaries: [],
    contingentEqualShares: "",
    organDonation: "Yes",
    // ── added by Prompt 3B ──
    poaAgentName: "Raga Hassan",
    poaAgentRelationship: "Spouse/Partner",
    poaSuccessorAgentName: "Karim Hassan",
    poaSuccessorAgentRelationship: "Sibling",
    poaPowers: ["Banking and finances", "Real estate transactions"],
    poaEffective: "springing",
    patientAdvocateName: "Raga Hassan",
    patientAdvocateRelationship: "Spouse/Partner",
    successorPatientAdvocateName: "Karim Hassan",
    lifeSustainingTreatment: "withhold_if_terminal_or_pvs",
    artificialNutrition: "withhold_if_terminal_or_pvs",
    hasHealthcareWishes: "No",
    healthcareWishesDescription: "",
    hasSpecificGifts: "No",
    specificGiftsDescription: "",
  };
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.PDF_RENDERER;
  else process.env.PDF_RENDERER = ORIGINAL_FLAG;
});

describe("will-flow answers satisfy every document in the will package", () => {
  const data = (() => {
    const r = mapIntakeToTemplateData(willFlowAnswers());
    expect(r.error).toBeNull();
    return r.data!;
  })();

  it.each(["will", "dpoa", "pad"])("validates for %s", (docType) => {
    expect(validateForDocument(docType, data)).toEqual([]);
  });

  it("carries the will-flow POA answers through the adapter", () => {
    expect(data.dpoa_agent.full_name).toBe("Raga Hassan");
    expect(data.first_successor_dpoa_agent.full_name).toBe("Karim Hassan");
    expect(data.dpoa_powers.sort()).toEqual(["banking", "real_estate"]);
    expect(data.dpoa_effective).toBe("springing");
  });

  it("carries the will-flow patient advocate answers through the adapter", () => {
    expect(data.patient_advocate.full_name).toBe("Raga Hassan");
    expect(data.successor_patient_advocate.full_name).toBe("Karim Hassan");
    expect(data.life_sustaining_treatment_preference).toBe("withhold_if_terminal_or_pvs");
    expect(data.artificial_nutrition_preference).toBe("withhold_if_terminal_or_pvs");
  });
});

describe("all three documents render under strict mode", () => {
  it.each([
    ["will", "LAST WILL AND TESTAMENT"],
    ["poa", "DURABLE POWER OF ATTORNEY"],
    ["healthcare_directive", "PATIENT ADVOCATE DESIGNATION"],
  ])("%s renders instead of blocking", async (routeDocType, title) => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await import("./generate-from-template");

    const result = await tryTemplateRender(routeDocType, willFlowAnswers());
    expect(result).not.toBeNull();
    expect(result!.documentText).toContain(title);
    expect(result!.documentText).not.toContain("{{");
    expect(result!.pdfBuffer.length).toBeGreaterThan(1000);
  }, 30000);

  it("the springing choice reaches the generated power of attorney", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await import("./generate-from-template");
    const result = await tryTemplateRender("poa", willFlowAnswers());
    expect(result!.documentText).toContain("Springing Effectiveness");
    expect(result!.documentText).toContain("has no power to act");
  }, 30000);

  it("a pre-3B will session still blocks, which is why the steps were added", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender, TemplateBlockedError } = await import("./generate-from-template");

    const old = willFlowAnswers();
    for (const k of [
      "poaAgentName", "poaAgentRelationship", "poaPowers", "poaEffective",
      "patientAdvocateName", "lifeSustainingTreatment", "artificialNutrition",
    ]) delete old[k];

    await expect(tryTemplateRender("poa", old)).rejects.toBeInstanceOf(TemplateBlockedError);
    await expect(tryTemplateRender("healthcare_directive", old)).rejects.toBeInstanceOf(TemplateBlockedError);
    // The will itself was never affected.
    await expect(tryTemplateRender("will", old)).resolves.not.toBeNull();
  }, 30000);
});
