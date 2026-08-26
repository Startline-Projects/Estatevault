/**
 * Prompt 3 — Patient Advocate Designation.
 *
 * Includes the binding attorney clarification of 2026-08: a PAD executes with
 * two witnesses only under MCL 700.5506. It carries NO notary block and NO
 * self-proving affidavit — that is a will-only concept.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderTemplate } from "./render-template";
import { parseRenderedText } from "./pdf/parser";
import { mapIntakeToTemplateData, validateForDocument, type TemplateWillIntake } from "./intake-adapter";

const DIR = join(__dirname, "templates");
const TEMPLATE = readFileSync(join(DIR, "pad-michigan-v1.1.0.txt"), "utf8");

function intake(overrides: Record<string, unknown> = {}): TemplateWillIntake {
  const r = mapIntakeToTemplateData({
    firstName: "Ahmed",
    lastName: "Hassan",
    city: "Dearborn",
    state: "Michigan",
    patientAdvocateName: "Raga Hassan",
    patientAdvocateRelationship: "Spouse",
    successorPatientAdvocateName: "Karim Hassan",
    lifeSustainingTreatment: "withhold_if_terminal_or_pvs",
    artificialNutrition: "withhold_if_terminal_or_pvs",
    organDonation: "Yes",
    ...overrides,
  });
  expect(r.error).toBeNull();
  return r.data!;
}

const render = (o: Record<string, unknown> = {}) => renderTemplate(TEMPLATE, intake(o));

describe("no notary, no affidavit (attorney clarification, binding)", () => {
  it("the template source contains no notary block and no affidavit", () => {
    expect(TEMPLATE).not.toContain("[NOTARY_BLOCK]");
    expect(TEMPLATE).not.toContain("[/NOTARY_BLOCK]");
    expect(TEMPLATE).not.toMatch(/^#+\s*NOTARY/im);
    expect(TEMPLATE).not.toMatch(/notary acknowledgment/i);
    expect(TEMPLATE).not.toMatch(/affidavit/i);
    // "notary" survives only in the sentence telling the client none is needed.
    const mentions = TEMPLATE.match(/notar/gi) ?? [];
    expect(mentions).toHaveLength(2); // "notary is needed" + "not notarized"
  });

  it("no notary_block survives into the parsed document", () => {
    expect(parseRenderedText(render()).some((b) => b.type === "notary_block")).toBe(false);
  });

  it("executes on two witnesses instead", () => {
    const out = render();
    expect(out).toContain("## WITNESS ATTESTATION");
    expect(out).toContain("MCL 700.5506(4)");
    expect(out).toContain("[SIGNATURE] Witness One");
    expect(out).toContain("[SIGNATURE] Witness Two");
  });

  it("tells the client no notary is needed", () => {
    expect(render()).toContain("No notary is needed");
  });
});

describe("statute strip removed", () => {
  it("drops the combined citation line from the instruction sheet", () => {
    const out = render();
    expect(out).not.toContain("Michigan Mental Health Code, MCL 330.1404");
    expect(out).not.toContain("Federal HIPAA, 45 C.F.R. Part 164");
    expect(out).not.toContain("State of Michigan  ·  MCL 700.5506 et seq.  ·");
  });

  it("keeps the statutory citations that sit inside operative articles", () => {
    // Removing the decorative strip must not strip the law from the document.
    const body = render().split("## OPERATION OF THIS DOCUMENT")[0];
    expect(body).toContain("MCL 700.5506");
    expect(body).toContain("MCL 330.1404");
  });
});

describe("document order: designation, acceptance, instructions", () => {
  it("orders the three parts correctly", () => {
    const out = render();
    const article1 = out.indexOf("## ARTICLE I");
    const witnesses = out.indexOf("## WITNESS ATTESTATION");
    const acceptance = out.indexOf("## ACCEPTANCE BY PATIENT ADVOCATE");
    const sheet = out.indexOf("## OPERATION OF THIS DOCUMENT");
    expect(witnesses).toBeGreaterThan(article1);
    expect(acceptance).toBeGreaterThan(witnesses);
    expect(sheet).toBeGreaterThan(acceptance);
  });

  it("starts the acceptance and the instructions on their own pages", () => {
    const blocks = parseRenderedText(render());
    const ack = blocks.findIndex((b) => b.type === "document_header" && b.text === "ACCEPTANCE BY PATIENT ADVOCATE");
    const sheet = blocks.findIndex((b) => b.type === "document_header" && b.text === "OPERATION OF THIS DOCUMENT");
    expect(blocks[ack - 1]?.type).toBe("page_break");
    expect(blocks[sheet - 1]?.type).toBe("page_break");
  });
});

describe("medical preferences reach the document", () => {
  const CASES: Array<[string, string]> = [
    ["continue_all", "Continue All Life-Sustaining Treatment"],
    ["withhold_if_terminal", "Withhold if Terminal Condition."],
    ["withhold_if_pvs", "Withhold if Persistent Vegetative State"],
    ["withhold_if_terminal_or_pvs", "Withhold if Terminal Condition or Persistent Vegetative State"],
    ["advocate_decides", "Decision Left to My Patient Advocate"],
  ];

  it.each(CASES)("life-sustaining %s renders its own branch", (value, marker) => {
    const out = render({ lifeSustainingTreatment: value });
    const section = out.slice(out.indexOf("Section 5.1"), out.indexOf("Section 5.2"));
    expect(section).toContain(marker);
  });

  const NUTRITION: Array<[string, string]> = [
    ["provide_all", "Provide in All Circumstances"],
    ["withhold_if_terminal", "Withhold if Terminal Condition."],
    ["withhold_if_pvs", "Withhold if Persistent Vegetative State"],
    ["withhold_if_terminal_or_pvs", "Withhold if Terminal Condition or Persistent Vegetative State"],
    ["advocate_decides", "Decision Left to My Patient Advocate"],
  ];

  it.each(NUTRITION)("artificial nutrition %s renders its own branch", (value, marker) => {
    const out = render({ artificialNutrition: value });
    const section = out.slice(out.indexOf("Section 5.2"), out.indexOf("Section 5.3"));
    expect(section).toContain(marker);
  });

  it("no longer blocks strict validation once both are answered", () => {
    expect(validateForDocument("pad", intake())).toEqual([]);
  });

  it("still blocks when a preference is missing", () => {
    const reasons = validateForDocument("pad", intake({ lifeSustainingTreatment: undefined }));
    expect(reasons.some((r) => r.startsWith("life-sustaining treatment preference"))).toBe(true);
  });
});
