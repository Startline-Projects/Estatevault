/**
 * Prompt 7 — the three new Trust Package documents, in both trust structures.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderTemplate } from "./render-template";
import { parseRenderedText } from "./pdf/parser";
import { mapIntakeToTemplateData, validateForDocument } from "./intake-adapter";

const DIR = join(__dirname, "templates");
const CERT = readFileSync(join(DIR, "certification-of-trust-michigan-v1.0.0.txt"), "utf8");
const ASSIGN = readFileSync(join(DIR, "assignment-personal-property-michigan-v1.0.0.txt"), "utf8");
const FUNDING = readFileSync(join(DIR, "trust-funding-instructions-v1.0.0.txt"), "utf8");
const TRUST = readFileSync(join(DIR, "trust-michigan-v1.1.0.txt"), "utf8");

const ORIGINAL = process.env.PDF_RENDERER;
beforeEach(() => vi.resetModules());
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PDF_RENDERER;
  else process.env.PDF_RENDERER = ORIGINAL;
});

function answers(joint: boolean) {
  return {
    firstName: "Ahmed", lastName: "Hassan", city: "Dearborn", state: "Michigan",
    trustName: "The Hassan Family Revocable Living Trust",
    successorTrusteeName: "Karim Hassan", successorTrusteeRelationship: "Sibling",
    executorName: "Raga Hassan", executorRelationship: "Spouse/Partner",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "" }],
    ...(joint ? { secondGrantorName: "Raga Hassan", secondGrantorRelationship: "Spouse" } : {}),
  };
}
const data = (joint: boolean) => mapIntakeToTemplateData(answers(joint)).data!;

describe("joint vs single is driven by a named second grantor", () => {
  it("naming one makes the trust joint", () => {
    expect(data(true).is_joint_trust).toBe(true);
    expect(data(true).grantor_2_full_name).toBe("Raga Hassan");
  });
  it("not naming one leaves it single", () => {
    expect(data(false).is_joint_trust).toBe(false);
    expect(data(false).grantor_2_full_name).toBe("");
  });
});

describe("Certification of Trust", () => {
  it("uses two-grantor language and a joint revocation clause for a joint trust", () => {
    const out = renderTemplate(CERT, data(true));
    expect(out).toContain("The Grantors of the trust are Ahmed Hassan and Raga Hassan");
    expect(out).toContain("exercisable jointly and not individually");
    expect(out).toContain("Any one Trustee, acting alone, may sign for the trust");
  });

  it("uses single-grantor language for a single trust", () => {
    const out = renderTemplate(CERT, data(false));
    expect(out).toContain("The Grantor of the trust is Ahmed Hassan.");
    expect(out).toContain("The Grantor retains the power to revoke the trust.");
    expect(out).not.toContain("exercisable jointly");
  });

  it("both trustees sign a joint certification, one signs a single", () => {
    const joint = parseRenderedText(renderTemplate(CERT, data(true))).filter((b) => b.type === "signature");
    const single = parseRenderedText(renderTemplate(CERT, data(false))).filter((b) => b.type === "signature");
    expect(joint).toHaveLength(2);
    expect(single).toHaveLength(1);
  });

  it("the notary acknowledges both trustees on a joint trust", () => {
    expect(renderTemplate(CERT, data(true))).toContain("by Ahmed Hassan and Raga Hassan, as Trustees");
    expect(renderTemplate(CERT, data(false))).toContain("by Ahmed Hassan, as Trustee");
  });

  it("carries a notary block", () => {
    expect(parseRenderedText(renderTemplate(CERT, data(false))).some((b) => b.type === "notary_block")).toBe(true);
  });

  it("leaves the taxpayer identification line blank", () => {
    const out = renderTemplate(CERT, data(false));
    expect(out).toContain("Taxpayer Identification Number: ______________________");
  });

  it("tells the client to write the number in by hand", () => {
    const out = renderTemplate(CERT, data(false));
    const sheet = out.slice(out.indexOf("## OPERATION OF THIS DOCUMENT"));
    expect(sheet).toContain("EstateVault does not collect or store Social Security numbers");
    expect(sheet).toContain("write your own Social Security number on that line by hand");
  });
});

describe("no SSN is collected anywhere", () => {
  it("no template asks for one", () => {
    for (const [name, tpl] of [["certification", CERT], ["assignment", ASSIGN], ["funding", FUNDING], ["trust", TRUST]] as const) {
      expect(tpl, name).not.toMatch(/\{\{[^}]*ssn[^}]*\}\}/i);
      expect(tpl, name).not.toMatch(/\{\{[^}]*social_security[^}]*\}\}/i);
    }
  });

  it("the intake schema has no SSN field", () => {
    const keys = Object.keys(data(false));
    expect(keys.filter((k) => /ssn|social/i.test(k))).toEqual([]);
  });

  it("no rendered document contains a filled-in number", () => {
    const out = renderTemplate(CERT, data(true));
    // The only SSN mention is the blank line and the sheet's instruction.
    expect(out).not.toMatch(/\d{3}-\d{2}-\d{4}/);
  });
});

describe("Assignment of Personal Property", () => {
  it("mentions the second assignment only on a joint trust", () => {
    expect(renderTemplate(ASSIGN, { ...data(true), assignor_full_name: "Ahmed Hassan", assignment_trustee_line: "x" }))
      .toContain("each of you receives a separate assignment");
    expect(renderTemplate(ASSIGN, { ...data(false), assignor_full_name: "Ahmed Hassan", assignment_trustee_line: "x" }))
      .not.toContain("each of you receives a separate assignment");
  });

  it("carries a notary block and one signature", () => {
    const blocks = parseRenderedText(renderTemplate(ASSIGN, { ...data(false), assignor_full_name: "Ahmed Hassan", assignment_trustee_line: "x" }));
    expect(blocks.some((b) => b.type === "notary_block")).toBe(true);
    expect(blocks.filter((b) => b.type === "signature")).toHaveLength(1);
  });
});

describe("each grantor's assignment names that grantor", () => {
  it("g1 assigns the first grantor's property, g2 the second's", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await import("./generate-from-template");

    const g1 = await tryTemplateRender("assignment_personal_property_g1", answers(true));
    const g2 = await tryTemplateRender("assignment_personal_property_g2", answers(true));

    expect(g1!.documentText).toContain("I, Ahmed Hassan, of Dearborn");
    expect(g2!.documentText).toContain("I, Raga Hassan, of Dearborn");
    expect(g1!.documentText).not.toContain("I, Raga Hassan, of Dearborn");
  }, 30000);

  it("a second assignment is refused for a single trust", () => {
    const reasons = validateForDocument("assignment_personal_property_g2", data(false));
    expect(reasons.some((r) => r.includes("joint trust"))).toBe(true);
  });
});

describe("Funding Instructions", () => {
  it("uses the UPL-rewritten text, not the law-firm source", () => {
    const out = renderTemplate(FUNDING, data(false));
    expect(out).toContain("a licensed attorney can assist you");
    expect(out).not.toMatch(/\bwe recommend\b/i);
    expect(out).not.toMatch(/call our office/i);
  });

  it("points every filing instruction at the Vault", () => {
    const out = renderTemplate(FUNDING, data(false));
    const fileLines = out.match(/File a copy[^\n]*/g) ?? [];
    expect(fileLines.length).toBeGreaterThanOrEqual(8);
    for (const line of fileLines) expect(line).toContain("Trust Assets section of your Vault");
  });

  it("renders the filing lines as bold blocks", () => {
    const bold = parseRenderedText(renderTemplate(FUNDING, data(false))).filter((b) => b.type === "bold_statutory");
    expect(bold.length).toBeGreaterThanOrEqual(10);
  });

  it("carries the locked disclaimer footer", () => {
    for (const tpl of [CERT, ASSIGN, FUNDING]) {
      expect(tpl).toContain("Document preparation service only. Not legal advice. No attorney-client relationship created.");
    }
  });
});

describe("trust Article III for joint grantors", () => {
  it("names co-trustees and provides for the survivor", () => {
    const out = renderTemplate(TRUST, data(true));
    const a3 = out.slice(out.indexOf("## ARTICLE III"), out.indexOf("## ARTICLE IV"));
    expect(a3).toContain("Initial Co-Trustees");
    expect(a3).toContain("shall serve together as the initial Co-Trustees");
    expect(a3).toContain("the surviving or remaining Grantor shall continue to serve alone as sole Trustee");
    expect(a3).toContain("If both Grantors are unable or unwilling");
  });

  it("leaves the single-grantor wording untouched", () => {
    const out = renderTemplate(TRUST, data(false));
    const a3 = out.slice(out.indexOf("## ARTICLE III"), out.indexOf("## ARTICLE IV"));
    expect(a3).toContain("The Grantor shall serve as the initial Trustee");
    expect(a3).toContain("If the Grantor is unable or unwilling to continue serving as Trustee, ceases to serve");
    expect(a3).not.toContain("Co-Trustee");
  });
});

describe("all three render through the strict-mode gate", () => {
  it.each([
    ["certification_of_trust", true],
    ["certification_of_trust", false],
    ["assignment_personal_property_g1", true],
    ["assignment_personal_property_g1", false],
    ["trust_funding_instructions", true],
    ["trust_funding_instructions", false],
  ])("%s renders for joint=%s", async (docType, joint) => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await import("./generate-from-template");
    const result = await tryTemplateRender(docType, answers(joint as boolean));
    expect(result).not.toBeNull();
    expect(result!.pdfBuffer.length).toBeGreaterThan(1000);
    expect(result!.documentText).not.toContain("{{");
    expect(result!.documentText).not.toContain("[[");
  }, 30000);
});
