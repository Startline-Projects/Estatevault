/**
 * Prompt 9 item B — the Advance Healthcare Directive.
 *
 * The attorney supplied this document whole. The only permitted changes were
 * placeholders becoming variables, numbering becoming symbolic, and the
 * conditional organ-donation section. These tests pin the text down against the
 * source file so a later edit cannot quietly rewrite his words.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { renderTemplate } from "./render-template";
import { parseRenderedText } from "./pdf/parser";
import { mapIntakeToTemplateData, validateForDocument, type TemplateWillIntake } from "./intake-adapter";

const TEMPLATE = readFileSync(
  join(__dirname, "templates", "advance-healthcare-directive-michigan-v1.0.0.txt"), "utf8");

const ORIGINAL = process.env.PDF_RENDERER;
beforeEach(() => vi.resetModules());
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PDF_RENDERER;
  else process.env.PDF_RENDERER = ORIGINAL;
});

function answers(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Ahmed", lastName: "Hassan", city: "Dearborn", state: "Michigan",
    patientAdvocateName: "Raga Hassan", patientAdvocateRelationship: "Spouse/Partner",
    successorPatientAdvocateName: "Karim Hassan",
    secondSuccessorPatientAdvocateName: "Nadia Hassan",
    organDonation: "any_purpose",
    ...overrides,
  };
}
const data = (o: Record<string, unknown> = {}): TemplateWillIntake => {
  const r = mapIntakeToTemplateData(answers(o));
  expect(r.error).toBeNull();
  return r.data!;
};
const render = (o: Record<string, unknown> = {}) => renderTemplate(TEMPLATE, data(o));
const sheetOf = (s: string) => s.slice(s.indexOf("## OPERATION OF THIS DOCUMENT"));
const bodyOf = (s: string) => s.slice(0, s.indexOf("## OPERATION OF THIS DOCUMENT"));

describe("the old Patient Advocate Designation is gone", () => {
  it("its template no longer exists", () => {
    expect(existsSync(join(__dirname, "templates", "pad-michigan-v1.1.0.txt"))).toBe(false);
    expect(existsSync(join(__dirname, "templates", "pad-michigan-v1.1.0.ts"))).toBe(false);
  });

  it("both the old template key and the persisted route type resolve to the new document", async () => {
    const { toTemplateDocType } = await import("./pdf/doc-type-map");
    const { DOCUMENT_CONFIG } = await import("./pdf/document-config");
    // "healthcare_directive" is persisted on documents rows and must keep working.
    expect(toTemplateDocType("healthcare_directive")).toBe("ahcd");
    expect(DOCUMENT_CONFIG.ahcd.title).toBe("ADVANCE HEALTHCARE DIRECTIVE");
    // "pad" survives as an alias.
    expect(DOCUMENT_CONFIG.pad.templateFile).toBe(DOCUMENT_CONFIG.ahcd.templateFile);
    expect(DOCUMENT_CONFIG.pad.filenameLabel).toBe("Advance Healthcare Directive");
  });
});

describe("the attorney's text is integrated verbatim", () => {
  const out = render();

  it("keeps his article and section numbering style", () => {
    expect(out).toContain("## ARTICLE One — RECITALS");
    expect(out).toContain("## ARTICLE Four — DEFINITIONS");
    expect(out).toContain("### Section 1.01 — Designation of Patient Advocate");
    expect(out).toContain("### Section 3.10 — Revocation of Prior Powers");
  });

  it("keeps the opening declaration word for word", () => {
    expect(out).toContain(
      "I, Ahmed Hassan, the principal, am an adult of sound mind, and I execute this Advance Healthcare Directive freely and voluntarily, understanding both its purpose and its consequences.");
  });

  it("keeps the DNR and life-sustaining language as fixed text", () => {
    expect(out).toContain("resuscitation, including Do Not Resuscitate (DNR) orders and Cardiopulmonary Resuscitation (CPR) directives");
    expect(out).toContain("I do not want my life to be prolonged, and I do not want life-sustaining treatment");
    expect(out).toContain("I am in a coma or persistent vegetative state that is reasonably determined to be irreversible.");
  });

  it("keeps the witness disqualification sentence exactly", () => {
    expect(out).toContain(
      "Neither of the undersigned is the principal’s spouse, parent, child, grandchild, sibling, presumptive heir, known devisee, or attending physician, and neither is an employee of the principal’s life or health insurance provider or of the health facility treating the principal.");
  });

  it("keeps every bullet of the Acceptance by Patient Advocate block", () => {
    const acceptance = out.slice(out.indexOf("## ACCEPTANCE BY PATIENT ADVOCATE"));
    for (const bullet of [
      "This Advance Healthcare Directive is not effective unless the principal is unable to participate",
      "I shall act in accordance with the standards of care applicable to fiduciaries",
      "I shall take reasonable steps to follow the desires, instructions, or guidelines",
      "I may make a decision to withhold or withdraw treatment that would allow the principal to die only if",
      "A patient advocate designation cannot be used to authorize a specific mental health treatment procedure",
      "I shall not receive compensation for the performance of my authority",
      "I shall keep the principal’s medical records and information confidential",
      "I may revoke my acceptance at any time by notifying the principal",
      "If the principal has designated one or more alternate patient advocates",
    ]) {
      expect(acceptance).toContain(bullet);
    }
    expect(acceptance).toContain("This acceptance is required by MCL 700.5507.");
  });
});

describe("placeholders became variables", () => {
  it("names the principal and all three advocates", () => {
    const out = render();
    expect(out).toContain("I designate Raga Hassan to serve as my Patient Advocate");
    expect(out).toContain("I designate Karim Hassan as first alternate Patient Advocate");
    expect(out).toContain("I designate Nadia Hassan as second alternate Patient Advocate");
    expect(out).not.toContain("[CLIENT NAME]");
    expect(out).not.toContain("[PRIMARY PATIENT ADVOCATE]");
  });

  it("leaves nothing unresolved", () => {
    expect(render()).not.toContain("{{");
    expect(render()).not.toContain("[[");
  });
});

describe("two witnesses, no notary", () => {
  it("has the witness attestation and two witness signatures", () => {
    const out = render();
    expect(out).toContain("## WITNESS ATTESTATION");
    expect(parseRenderedText(out).filter((b) => b.type === "signature").length).toBeGreaterThanOrEqual(6);
  });

  it("carries no notary block — the guard from Prompt 3 now protects this template", () => {
    expect(TEMPLATE).not.toContain("[NOTARY_BLOCK]");
    expect(TEMPLATE).not.toMatch(/^#+\s*NOTARY/im);
    expect(parseRenderedText(render()).some((b) => b.type === "notary_block")).toBe(false);
  });
});

describe("organ donation is the only healthcare choice besides the advocates", () => {
  it("silent renders no organ donation section and leaves the Statement at 2.10", () => {
    const out = render({ organDonation: "silent" });
    expect(out).not.toContain("— Organ Donation");
    expect(out).toContain("### Section 2.10 — Statement of Limitations, Desires, and Special Provisions");
  });

  it.each([
    ["none", "I do not wish to make an anatomical gift"],
    ["any_purpose", "I give any needed organ, tissue, or other part of my body for any purpose authorized by law"],
  ])("%s renders as 2.10 and pushes the Statement to 2.11", (choice, marker) => {
    const out = render({ organDonation: choice });
    expect(out).toContain("### Section 2.10 — Organ Donation");
    expect(out).toContain(marker);
    expect(out).toContain("### Section 2.11 — Statement of Limitations, Desires, and Special Provisions");
  });

  it("specific purposes inserts the client's own words", () => {
    const out = render({ organDonation: "specific_purposes", organDonationPurposes: "transplantation and therapy only" });
    expect(out).toContain("for the following purposes only: transplantation and therapy only.");
    expect(out).toContain("### Section 2.11 — Statement of Limitations");
  });

  it("the in-prose cross-reference to the records section survives the shift", () => {
    for (const choice of ["silent", "any_purpose"]) {
      expect(render({ organDonation: choice })).toContain(
        "The medical information and medical records provisions in Section 2.04");
    }
  });

  it("blocks generation when unanswered, and when purposes are missing", () => {
    expect(validateForDocument("ahcd", data({ organDonation: undefined })))
      .toContain("organ donation preference");
    expect(validateForDocument("ahcd", data({ organDonation: "specific_purposes" })))
      .toContain("the purposes the organ donation is limited to");
  });

  it("folds an older session's Yes/No onto the new answers", () => {
    expect(data({ organDonation: "Yes" }).organ_donation).toBe("any_purpose");
    expect(data({ organDonation: "No" }).organ_donation).toBe("none");
    expect(data({ organDonation: "advocate_decides" }).organ_donation).toBe("silent");
  });
});

describe("the instruction sheet", () => {
  it("cites no statute", () => {
    expect(sheetOf(render())).not.toMatch(/MCL/);
  });

  it("keeps the statute inside the operative document", () => {
    expect(bodyOf(render())).toContain("MCL 700.5507");
  });

  it("explains the witnesses, the acceptance and when the advocate may act", () => {
    const sheet = sheetOf(render());
    expect(sheet).toContain("Two witnesses must watch you sign");
    expect(sheet).toContain("No notary is needed");
    expect(sheet).toContain("cannot exercise any authority until they have signed the Acceptance page");
    expect(sheet).toContain("You do not need a court to declare you incapacitated");
  });
});

describe("it renders through the strict-mode gate", () => {
  it.each(["healthcare_directive", "advance_healthcare_directive"])("%s produces a PDF", async (routeType) => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await import("./generate-from-template");
    const result = await tryTemplateRender(routeType, answers());
    expect(result).not.toBeNull();
    expect(result!.pdfBuffer.length).toBeGreaterThan(1000);
    expect(result!.templateVersion).toBe("1.0.0-michigan");
  }, 30000);
});
