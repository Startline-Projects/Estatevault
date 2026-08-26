/**
 * Prompt 4 — Last Will and Testament.
 *
 *   1. funeral and burial preferences are directed to the Personal
 *      Representative, not a Funeral Representative
 *   2. the "Self-Proving Affidavit" heading is gone; the notary and affidavit
 *      content stays
 *   3. the signing steps live on the instruction sheet, not in the will body
 *   4. the sheet explains the two-witness rule, what the self-proving affidavit
 *      does, and that signing revokes all prior wills
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderTemplate } from "./render-template";
import { parseRenderedText } from "./pdf/parser";
import { mapIntakeToTemplateData, type TemplateWillIntake } from "./intake-adapter";

const TEMPLATE = readFileSync(join(__dirname, "templates", "will-michigan-v1.1.0.txt"), "utf8");

function intake(overrides: Record<string, unknown> = {}): TemplateWillIntake {
  const r = mapIntakeToTemplateData({
    firstName: "Ahmed",
    lastName: "Hassan",
    city: "Dearborn",
    state: "Michigan",
    executorName: "Raga Hassan",
    executorRelationship: "Spouse/Partner",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "", contingency: "other_beneficiaries" }],
    beneficiariesEqualShares: "",
    ...overrides,
  });
  expect(r.error).toBeNull();
  return r.data!;
}

const render = (o: Record<string, unknown> = {}) => renderTemplate(TEMPLATE, intake(o));
const sheetOf = (out: string) => out.slice(out.indexOf("## OPERATION OF THIS DOCUMENT"));
/**
 * Slice the funeral clause by heading text, not by section number: numbers are
 * assigned at render time now, so "Section 8.2" is a different clause depending
 * on whether the guardian article rendered.
 */
const funeralClause = (body: string) => {
  const start = body.indexOf("— Funeral and Burial Preference.");
  return body.slice(start, body.indexOf("— Reference to Funeral Representative Designation.", start));
};
const bodyOf = (out: string) => out.slice(0, out.indexOf("## OPERATION OF THIS DOCUMENT"));

describe("1. funeral preferences go to the Personal Representative", () => {
  it.each([
    ["burial", "interred by burial"],
    ["cremation", "disposed of by cremation"],
  ])("%s names the Personal Representative and no Funeral Representative", (pref, marker) => {
    const body = bodyOf(renderTemplate(TEMPLATE, { ...intake(), funeral_preference: pref }));
    const clause = funeralClause(body);
    expect(clause).toContain(marker);
    expect(clause).toContain("My Personal Representative shall make the final arrangements");
    expect(clause).not.toContain("Funeral Representative");
  });

  it("family_decides also routes to the Personal Representative", () => {
    const body = bodyOf(render()); // funeral_preference defaults to family_decides
    const clause = funeralClause(body);
    expect(clause).toContain("to my Personal Representative");
    expect(clause).not.toContain("Funeral Representative");
  });
});

describe("2. the Self-Proving Affidavit heading is removed, the content is not", () => {
  it("has no such heading", () => {
    expect(TEMPLATE).not.toContain("## SELF-PROVING AFFIDAVIT");
    const headings = parseRenderedText(render())
      .filter((b) => b.type === "document_header")
      .map((b) => (b as { text: string }).text);
    expect(headings).not.toContain("SELF-PROVING AFFIDAVIT");
  });

  it("keeps the affidavit text, its statute, and the notary block", () => {
    const out = render();
    expect(out).toContain("Pursuant to MCL 700.2504");
    expect(out).toContain("all of these persons being by me first duly sworn");
    expect(out).toContain("[NOTARY_BLOCK]");
    expect(out).toContain("Sworn to and signed in my presence");
  });
});

describe("3. signing steps are on the sheet, not in the will body", () => {
  it("puts all seven steps on the instruction sheet", () => {
    const sheet = sheetOf(render());
    for (let n = 1; n <= 7; n++) expect(sheet).toContain(`STEP ${n} -`);
  });

  it("keeps them out of the operative will", () => {
    const body = bodyOf(render());
    expect(body).not.toContain("STEP 1 -");
    expect(body).not.toMatch(/EXECUTION INSTRUCTIONS/);
  });

  it("starts the sheet on its own page after the notary block", () => {
    const blocks = parseRenderedText(render());
    const sheet = blocks.findIndex((b) => b.type === "document_header" && b.text === "OPERATION OF THIS DOCUMENT");
    const notary = blocks.findIndex((b) => b.type === "notary_block");
    expect(blocks[sheet - 1]?.type).toBe("page_break");
    expect(sheet).toBeGreaterThan(notary);
  });
});

describe("4. the sheet explains the three things in plain language", () => {
  const sheet = sheetOf(render());

  it("the two-witness requirement", () => {
    expect(sheet).toContain("a will requires two witnesses to be valid");
    expect(sheet).toContain("must not be people who inherit under this Will");
  });

  it("what the self-proving affidavit does and why it is included", () => {
    expect(sheet).toContain("self-proving affidavit under MCL 700.2504");
    expect(sheet).toContain("without tracking down your witnesses");
    expect(sheet).toContain("does not replace the witness requirement");
  });

  it("that signing revokes all prior wills", () => {
    expect(sheet).toContain("revokes and voids all prior wills");
    expect(sheet).toContain("no earlier one has any effect");
  });
});
