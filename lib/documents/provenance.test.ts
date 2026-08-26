/**
 * Provenance recorded at generation: the real template version, and a
 * fingerprint of the intake a document's content depends on.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { beneficiaryFingerprint } from "./staleness";

const ORIGINAL = process.env.PDF_RENDERER;
beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PDF_RENDERER;
  else process.env.PDF_RENDERER = ORIGINAL;
});

function trustAnswers(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Ahmed", lastName: "Hassan", city: "Dearborn", state: "Michigan",
    executorName: "Raga Hassan", executorRelationship: "Spouse/Partner",
    successorTrusteeName: "Raga Hassan", successorTrusteeRelationship: "Spouse/Partner",
    beneficiaries: [
      { name: "Ahmed Junior", relationship: "Child", share: "", contingency: "other_beneficiaries" },
      { name: "Raga Hassan", relationship: "Spouse", share: "", contingency: "other_beneficiaries" },
    ],
    beneficiariesEqualShares: "Yes",
    ...overrides,
  };
}

describe("template version is the real one", () => {
  it.each([
    ["will", "1.1.0-michigan"],
    ["trust", "1.1.0-michigan"],
    ["pour_over_will", "1.1.0-michigan"],
  ])("%s reports %s, not the hardcoded 1.0", async (docType, expected) => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await import("./generate-from-template");
    const result = await tryTemplateRender(docType, trustAnswers());
    expect(result).not.toBeNull();
    expect(result!.templateVersion).toBe(expected);
    expect(result!.templateVersion).not.toBe("1.0");
  }, 30000);
});

describe("fingerprint is recorded only where content is intake-coupled", () => {
  it("the pour-over will carries one, matching its beneficiaries", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await import("./generate-from-template");
    const { mapIntakeToTemplateData } = await import("./intake-adapter");

    const answers = trustAnswers();
    const result = await tryTemplateRender("pour_over_will", answers);
    const expected = beneficiaryFingerprint(mapIntakeToTemplateData(answers).data!.primary_beneficiaries);

    expect(result!.sourceFingerprint).toBe(expected);
  }, 30000);

  it("the will and the trust carry none — nothing to go stale against", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await import("./generate-from-template");
    for (const docType of ["will", "trust"]) {
      const result = await tryTemplateRender(docType, trustAnswers());
      expect(result!.sourceFingerprint).toBeNull();
    }
  }, 30000);

  it("changes when the beneficiaries change, and not otherwise", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await import("./generate-from-template");

    const base = (await tryTemplateRender("pour_over_will", trustAnswers()))!.sourceFingerprint;
    const sameAgain = (await tryTemplateRender("pour_over_will", trustAnswers()))!.sourceFingerprint;
    const editedShares = (await tryTemplateRender("pour_over_will", trustAnswers({
      beneficiaries: [
        { name: "Ahmed Junior", relationship: "Child", share: "70", contingency: "other_beneficiaries" },
        { name: "Raga Hassan", relationship: "Spouse", share: "30", contingency: "other_beneficiaries" },
      ],
      beneficiariesEqualShares: "No",
    })))!.sourceFingerprint;
    const unrelatedEdit = (await tryTemplateRender("pour_over_will", trustAnswers({
      executorName: "Karim Hassan",
    })))!.sourceFingerprint;

    expect(sameAgain).toBe(base);
    expect(editedShares).not.toBe(base);
    // Section 3.3 does not render the executor, so this is not staleness.
    expect(unrelatedEdit).toBe(base);
  }, 60000);
});
