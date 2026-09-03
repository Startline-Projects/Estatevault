/**
 * Prompt 6 — Pour-Over Will.
 *
 *   1. Section 3.3 lists the client's actual primary trust beneficiaries with
 *      their shares, taken from the same intake the trust renders from
 *   2. the signing steps live on the instruction sheet
 *   3. the sheet is a separate final page behind [PAGE_BREAK]
 *   5. no hardcoded article numerals remain
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderTemplate } from "./render-template";
import { parseRenderedText } from "./pdf/parser";
import { mapIntakeToTemplateData, validateForDocument, type TemplateWillIntake } from "./intake-adapter";

const DIR = join(__dirname, "templates");
const POUR_OVER = readFileSync(join(DIR, "pour-over-will-michigan-v1.1.0.txt"), "utf8");
const TRUST = readFileSync(join(DIR, "trust-michigan-v1.1.0.txt"), "utf8");

function answers(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Ahmed",
    lastName: "Hassan",
    city: "Dearborn",
    state: "Michigan",
    executorName: "Raga Hassan",
    funeralPreference: "family_decides",
    executorRelationship: "Spouse/Partner",
    successorTrusteeName: "Raga Hassan",
    successorTrusteeRelationship: "Spouse/Partner",
    beneficiaries: [
      { name: "Ahmed Junior", relationship: "Child", share: "", contingency: "other_beneficiaries" },
      { name: "Raga Hassan", relationship: "Spouse", share: "", contingency: "other_beneficiaries" },
    ],
    beneficiariesEqualShares: "Yes",
    ...overrides,
  };
}

function intake(overrides: Record<string, unknown> = {}): TemplateWillIntake {
  const r = mapIntakeToTemplateData(answers(overrides));
  expect(r.error).toBeNull();
  return r.data!;
}

const render = (o: Record<string, unknown> = {}) => renderTemplate(POUR_OVER, intake(o));
const sheetOf = (out: string) => out.slice(out.indexOf("## OPERATION OF THIS DOCUMENT"));
const bodyOf = (out: string) => out.slice(0, out.indexOf("## OPERATION OF THIS DOCUMENT"));
const section33 = (out: string) => {
  const start = out.indexOf("— Backup Distribution.");
  return out.slice(start, out.indexOf("## ARTICLE", start));
};

describe("1. Section 3.3 names the actual trust beneficiaries", () => {
  it("lists each primary beneficiary with name, share and relationship", () => {
    const clause = section33(render());
    expect(clause).toContain("50% to Ahmed Junior, my Child.");
    expect(clause).toContain("50% to Raga Hassan, my Spouse.");
    expect(clause).not.toContain("{{");
  });

  it("matches the trust exactly, because both read the same intake", () => {
    const data = intake();
    const trustOut = renderTemplate(TRUST, data);
    const pourOut = renderTemplate(POUR_OVER, data);

    const trustList = (trustOut.match(/\d+% to [^,]+, my [^.]+\./g) ?? []);
    const pourList = (section33(pourOut).match(/\d+% to [^,]+, my [^.]+\./g) ?? []);
    expect(pourList).toEqual(trustList);
    expect(pourList.length).toBe(2);
  });

  it("carries custom percentages through unchanged", () => {
    const clause = section33(render({
      beneficiaries: [
        { name: "Ahmed Junior", relationship: "Child", share: "70", contingency: "other_beneficiaries" },
        { name: "Raga Hassan", relationship: "Spouse", share: "30", contingency: "other_beneficiaries" },
      ],
      beneficiariesEqualShares: "No",
    }));
    expect(clause).toContain("70% to Ahmed Junior");
    expect(clause).toContain("30% to Raga Hassan");
  });

  it("uses a largest-remainder split that totals 100 for three beneficiaries", () => {
    const clause = section33(render({
      beneficiaries: [
        { name: "A One", relationship: "Child", share: "", contingency: "other_beneficiaries" },
        { name: "B Two", relationship: "Child", share: "", contingency: "other_beneficiaries" },
        { name: "C Three", relationship: "Child", share: "", contingency: "other_beneficiaries" },
      ],
      beneficiariesEqualShares: "Yes",
    }));
    const pcts = (clause.match(/\d+% to/g) ?? []).map((m) => Number(m.replace("% to", "")));
    expect(pcts).toEqual([34, 33, 33]);
    expect(pcts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("includes no contingent beneficiaries", () => {
    const clause = section33(render({
      hasContingentBeneficiary: "Yes",
      contingentBeneficiaries: [{ name: "Nadia Hassan", relationship: "Sibling", share: "100", contingency: "other_beneficiaries" }],
      contingentEqualShares: "Yes",
    }));
    expect(clause).not.toContain("Nadia Hassan");
  });

  it("blocks generation rather than rendering an empty distribution", () => {
    const noBeneficiaries = intake({ beneficiaries: [] });
    expect(validateForDocument("pour_over_will", noBeneficiaries))
      .toContain("at least one primary beneficiary");
  });
});

describe("2 & 3. signing steps on a separate final sheet", () => {
  it("puts all seven steps on the sheet", () => {
    const sheet = sheetOf(render());
    for (let n = 1; n <= 7; n++) expect(sheet).toContain(`STEP ${n} -`);
  });

  it("removes the execution-instructions article from the will body", () => {
    const body = bodyOf(render());
    expect(body).not.toContain("STEP 1");
    expect(body).not.toContain("EXECUTION INSTRUCTIONS");
  });

  it("explains the two-witness rule and the self-proving affidavit for this document", () => {
    const sheet = sheetOf(render());
    expect(sheet).toContain("a will requires two witnesses to be valid, and a Pour-Over Will is a will");
    expect(sheet).toContain("self-proving affidavit");
    expect(sheet).not.toMatch(/MCL/);
    expect(sheet).toContain("does not replace the witness requirement");
    expect(sheet).toContain("revokes and voids all prior wills");
  });

  it("explains that the pour-over is a safety net, not a substitute for funding", () => {
    expect(sheetOf(render())).toContain("Safety Net, Not a Substitute for Funding");
  });

  it("starts the sheet on its own page after the notary block", () => {
    const blocks = parseRenderedText(render());
    const sheet = blocks.findIndex((b) => b.type === "document_header" && b.text === "OPERATION OF THIS DOCUMENT");
    const notary = blocks.findIndex((b) => b.type === "notary_block");
    expect(notary).toBeGreaterThan(-1);
    expect(sheet).toBeGreaterThan(notary);
    expect(blocks[sheet - 1]?.type).toBe("page_break");
  });
});

describe("5. auto-numbering, no hardcoded numerals", () => {
  it("declares every article and section symbolically", () => {
    expect(POUR_OVER).not.toMatch(/^## ARTICLE [IVXLCDM]+ —/m);
    expect(POUR_OVER).not.toMatch(/^### Section \d+\.\d+ —/m);
    expect(POUR_OVER).toContain("[[ARTICLE:pour_over]]");
  });

  it.each([true, false])("numbers contiguously with minor children = %s", (minors) => {
    const out = renderTemplate(POUR_OVER, { ...intake(), has_minor_children: minors } as TemplateWillIntake);
    const numerals = (out.match(/## ARTICLE ([IVXLCDM]+) —/g) ?? []).map((h) => h.replace("## ARTICLE ", "").replace(" —", ""));
    expect(numerals).toEqual(["I", "II", "III", "IV", "V", "VI", "VII"].slice(0, numerals.length));
    expect(numerals).toHaveLength(minors ? 7 : 6);
  });

  it("renders with no unresolved tags or markers", () => {
    const out = render();
    expect(out).not.toContain("{{");
    expect(out).not.toContain("[[");
  });
});
