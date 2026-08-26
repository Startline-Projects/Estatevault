/**
 * Prompt 8 — per-beneficiary contingency.
 *
 * Each primary beneficiary answers what happens to THAT person's share. The
 * global "contingent beneficiaries: yes or no" question and its shared list are
 * gone from all three documents that referenced them.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderTemplate } from "./render-template";
import { mapIntakeToTemplateData, validateForDocument } from "./intake-adapter";
import { migrateContingency, needsContingencyMigration } from "@/lib/intake/contingency-migration";
import { findResumePoint } from "@/lib/intake/incomplete-steps";

const DIR = join(__dirname, "templates");
const WILL = readFileSync(join(DIR, "will-michigan-v1.1.0.txt"), "utf8");
const TRUST = readFileSync(join(DIR, "trust-michigan-v1.1.0.txt"), "utf8");
const POUR = readFileSync(join(DIR, "pour-over-will-michigan-v1.1.0.txt"), "utf8");

const ORIGINAL = process.env.PDF_RENDERER;
beforeEach(() => vi.resetModules());
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PDF_RENDERER;
  else process.env.PDF_RENDERER = ORIGINAL;
});

function answers(beneficiaries: Array<Record<string, unknown>>) {
  return {
    firstName: "Ahmed", lastName: "Hassan", city: "Dearborn", state: "Michigan",
    executorName: "Raga Hassan", executorRelationship: "Spouse/Partner",
    successorTrusteeName: "Karim Hassan", successorTrusteeRelationship: "Sibling",
    beneficiaries, beneficiariesEqualShares: "Yes",
    // The POA and PAD need their own answers; a will order generates all three.
    poaAgentName: "Raga Hassan", poaAgentRelationship: "Spouse/Partner",
    poaPowers: ["Banking and finances"], poaEffective: "immediate",
    patientAdvocateName: "Raga Hassan", patientAdvocateRelationship: "Spouse/Partner",
    lifeSustainingTreatment: "withhold_if_terminal", artificialNutrition: "advocate_decides",
    organDonation: "Yes",
  };
}
const data = (b: Array<Record<string, unknown>>) => mapIntakeToTemplateData(answers(b)).data!;
const ONE = [{ name: "Layla Hassan", relationship: "Child", share: "", contingency: "descendants" }];
const THREE = [
  { name: "Layla Hassan", relationship: "Child", share: "", contingency: "descendants" },
  { name: "Omar Hassan", relationship: "Child", share: "", contingency: "named_individual", contingentName: "Nadia Hassan" },
  { name: "Raga Hassan", relationship: "Spouse", share: "", contingency: "other_beneficiaries" },
];

describe("the global question is gone from every document", () => {
  it.each([["will", WILL], ["trust", TRUST]])("%s has no global contingent section", (_n, tpl) => {
    expect(tpl).not.toContain("contingent_beneficiaries_not_empty");
    expect(tpl).not.toContain("— Contingent Beneficiaries.");
    expect(tpl).not.toContain("— Remainder Beneficiaries.");
  });

  it("no document references a contingent-beneficiaries section number", () => {
    for (const tpl of [WILL, TRUST, POUR]) {
      expect(tpl).not.toMatch(/contingent beneficiaries named in Section/i);
    }
  });
});

describe("each beneficiary's own answer reaches the document", () => {
  it.each([["will", WILL], ["trust", TRUST], ["pour-over", POUR]])("%s renders all three choices", (_n, tpl) => {
    const out = renderTemplate(tpl, data(THREE));
    expect(out).toContain("this share shall pass to the then-living descendants of Layla Hassan, per stirpes");
    expect(out).toContain("If Omar Hassan does not survive me by thirty (30) days, this share shall pass to Nadia Hassan.");
    expect(out).toContain("If Raga Hassan does not survive me by thirty (30) days, this share shall be distributed equally among the other");
  });

  it("a named individual who also predeceases falls back to the others", () => {
    const out = renderTemplate(WILL, data(THREE));
    expect(out).toContain("If Nadia Hassan also does not survive me by thirty (30) days");
  });

  it("descendants falls back to the others when there are none", () => {
    const out = renderTemplate(WILL, data(THREE));
    expect(out).toContain("If Layla Hassan leaves no then-living descendants");
  });

  it("works for a single beneficiary", () => {
    const out = renderTemplate(WILL, data(ONE));
    expect(out).toContain("100% to Layla Hassan");
    expect(out).toContain("then-living descendants of Layla Hassan");
  });

  it("per_stirpes is derived from the answer, not asked separately", () => {
    const d = data(THREE);
    expect(d.primary_beneficiaries.map((b) => b.per_stirpes)).toEqual([true, false, false]);
  });
});

describe("strict validation requires an answer for every beneficiary", () => {
  it("passes when all have answered", () => {
    for (const doc of ["will", "trust", "pour_over_will"]) {
      expect(validateForDocument(doc, data(THREE))).toEqual([]);
    }
  });

  it("names the beneficiary whose answer is missing", () => {
    const missing = [{ name: "Layla Hassan", relationship: "Child", share: "" }];
    const reasons = validateForDocument("will", data(missing));
    expect(reasons).toContain("what happens to Layla Hassan's share if they do not survive");
  });

  it("requires the person's name when 'someone else' is chosen", () => {
    const noName = [{ name: "Omar Hassan", relationship: "Child", share: "", contingency: "named_individual" }];
    expect(validateForDocument("will", data(noName))).toContain("the person who takes Omar Hassan's share");
  });

  it("never defaults a missing answer to a choice", () => {
    const missing = [{ name: "Layla Hassan", relationship: "Child", share: "" }];
    expect(data(missing).primary_beneficiaries[0].contingency).toBe("");
  });
});

describe("migrating an old-format session", () => {
  const base = (contingents: Array<Record<string, unknown>>, had: string) => ({
    beneficiaries: [
      { name: "Layla Hassan", relationship: "Child", share: "50" },
      { name: "Omar Hassan", relationship: "Child", share: "50" },
    ],
    hasContingentBeneficiary: had,
    contingentBeneficiaries: contingents,
    contingentEqualShares: "Yes",
  });

  it("a single named contingent maps forward to every beneficiary", () => {
    const result = migrateContingency(base([{ name: "Nadia Hassan", relationship: "Sibling" }], "Yes"));
    expect(result.migrated).toBe(true);
    expect(result.beneficiaries.every((b) => b.contingency === "named_individual")).toBe(true);
    expect(result.beneficiaries.every((b) => b.contingentName === "Nadia Hassan")).toBe(true);
    expect(result.priorAnswerSummary).toBeNull();
  });

  it("several named contingents are surfaced rather than discarded or guessed", () => {
    const result = migrateContingency(base(
      [{ name: "Nadia Hassan", relationship: "Sibling" }, { name: "Karim Hassan", relationship: "Sibling" }], "Yes"));
    expect(result.migrated).toBe(false);
    expect(result.beneficiaries.every((b) => !b.contingency)).toBe(true);
    expect(result.priorAnswerSummary).toContain("Nadia Hassan, Karim Hassan");
    expect(result.priorAnswerSummary).toContain("please choose again");
  });

  it("an old 'No' pre-selects nothing, because it says nothing about a single share", () => {
    const result = migrateContingency(base([], "No"));
    expect(result.migrated).toBe(false);
    expect(result.beneficiaries.every((b) => !b.contingency)).toBe(true);
    expect(result.priorAnswerSummary).toBeNull();
  });

  it("leaves an already-migrated session alone", () => {
    const already = { beneficiaries: THREE, hasContingentBeneficiary: "Yes", contingentBeneficiaries: [{ name: "X" }] };
    const result = migrateContingency(already);
    expect(result.migrated).toBe(false);
    expect(result.beneficiaries[0].contingency).toBe("descendants");
  });

  it("detects that an old session still needs the step", () => {
    expect(needsContingencyMigration(base([], "No"))).toBe(true);
    expect(needsContingencyMigration({ beneficiaries: THREE })).toBe(false);
    expect(needsContingencyMigration(null)).toBe(false);
  });
});

describe("the resume mechanism routes an old session to the beneficiaries step", () => {
  const old = {
    firstName: "Ahmed", lastName: "Hassan", city: "Dearborn", state: "Michigan",
    executorName: "Raga Hassan",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "100" }],
    hasContingentBeneficiary: "No",
    poaAgentName: "Raga Hassan", poaAgentRelationship: "Spouse/Partner",
    poaPowers: ["Banking and finances"], poaEffective: "immediate",
    patientAdvocateName: "Raga Hassan", patientAdvocateRelationship: "Spouse/Partner",
    lifeSustainingTreatment: "withhold_if_terminal", artificialNutrition: "advocate_decides",
    organDonation: "Yes",
  };

  it.each(["will", "trust"] as const)("%s flow routes to beneficiaries", (flow) => {
    const resume = findResumePoint(flow, old);
    expect(resume).not.toBeNull();
    expect(resume!.step).toBe("beneficiaries");
    expect(resume!.missingFields).toContain("beneficiaries[].contingency");
  });

  it("lets the session through once each beneficiary has answered", () => {
    const answered = { ...old, beneficiaries: [{ ...old.beneficiaries[0], contingency: "descendants" }] };
    expect(findResumePoint("will", answered)).toBeNull();
  });
});

describe("strict-mode rendering, both flows", () => {
  it.each([
    ["will", "will"], ["will", "poa"], ["will", "healthcare_directive"],
    ["trust", "trust"], ["trust", "pour_over_will"],
  ])("%s flow renders %s", async (_flow, docType) => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await import("./generate-from-template");
    const result = await tryTemplateRender(docType, answers(THREE));
    expect(result).not.toBeNull();
    expect(result!.documentText).not.toContain("{{");
    expect(result!.documentText).not.toContain("[[");
  }, 30000);

  it("blocks a document whose beneficiaries have not answered", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender, TemplateBlockedError } = await import("./generate-from-template");
    await expect(tryTemplateRender("will", answers([{ name: "Layla Hassan", relationship: "Child", share: "" }])))
      .rejects.toBeInstanceOf(TemplateBlockedError);
  }, 30000);
});
