/**
 * Prompt 10D — the funeral section reaches the Pour-Over Will, the attorney's
 * remains copy, and his signing steps applied to the sibling document.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderTemplate, stripComments } from "./render-template";
import { mapIntakeToTemplateData, validateForDocument } from "./intake-adapter";
import { FUNERAL_PREFERENCE_OPTIONS } from "@/components/intake/FuneralPreference";

const T = (n: string) => readFileSync(join(__dirname, "templates", n), "utf8");
const WILL = T("will-michigan-v1.1.0.txt");
const POUR = T("pour-over-will-michigan-v1.1.0.txt");

const CHOICES = ["burial", "cremation", "family_decides"] as const;

function intake(o: Record<string, unknown> = {}) {
  return {
    firstName: "Ahmed", lastName: "Hassan", city: "Dearborn Heights", state: "Michigan",
    maritalStatus: "Married", hasMinorChildren: "Yes",
    guardianName: "Samira Hassan", guardianRelationship: "Sibling",
    executorName: "Raga Hassan", executorRelationship: "Spouse/Partner",
    successorTrusteeName: "Karim Hassan", successorTrusteeRelationship: "Sibling",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "", contingency: "descendants" }],
    organDonation: "silent", isJointTrust: "No",
    ...o,
  };
}
const data = (o: Record<string, unknown> = {}) => mapIntakeToTemplateData(intake(o)).data!;

/** The paragraphs under a section heading, up to the next heading. */
function clauseUnder(out: string, heading: string): string {
  const i = out.indexOf(heading);
  expect(i, `heading not found: ${heading}`).toBeGreaterThan(-1);
  const rest = out.slice(i + heading.length);
  const next = rest.search(/\n#{2,3} /);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

describe("the Pour-Over Will carries the Will's funeral clause", () => {
  it.each(CHOICES)("%s renders byte-identically in both documents", (choice) => {
    const d = data({ funeralPreference: choice });
    const fromWill = clauseUnder(renderTemplate(WILL, d), "— Funeral and Burial Preference.");
    const fromPour = clauseUnder(renderTemplate(POUR, d), "— Funeral and Burial Preference.");
    expect(fromPour).toBe(fromWill);
    expect(fromPour.length).toBeGreaterThan(60);
  });

  it("renders exactly one of the three branches", () => {
    for (const choice of CHOICES) {
      const out = renderTemplate(POUR, data({ funeralPreference: choice }));
      const rendered = CHOICES.filter((c) =>
        out.includes({
          burial: "interred by burial",
          cremation: "disposed of by cremation",
          family_decides: "(whether burial, cremation, or other lawful method)",
        }[c]),
      );
      expect(rendered).toEqual([choice]);
    }
  });

  it("reads from the same intake field as the Will", () => {
    expect(POUR).toContain('{{#IF funeral_preference equals "burial"}}');
    expect(data({ funeralPreference: "cremation" }).funeral_preference).toBe("cremation");
  });

  it("is blocked rather than rendered empty when unanswered", () => {
    const missing = validateForDocument("pour_over_will", data({ funeralPreference: "" }));
    expect(missing).toContain("your wishes for your remains");
    expect(validateForDocument("pour_over_will", data({ funeralPreference: "burial" }))).toEqual([]);
  });
});

describe("article numbering stays contiguous in every permutation", () => {
  const permutations = CHOICES.flatMap((choice) =>
    [true, false].map((minors) => ({ choice, minors })),
  );

  it.each(permutations)("minors=$minors funeral=$choice", ({ choice, minors }) => {
    const out = renderTemplate(POUR, data({
      funeralPreference: choice,
      hasMinorChildren: minors ? "Yes" : "No",
      ...(minors ? {} : { guardianName: "", guardianRelationship: "" }),
    }));

    const romans = (out.match(/^## ARTICLE [IVXLC]+ — /gm) ?? [])
      .map((h) => h.replace("## ARTICLE ", "").replace(" — ", ""));
    const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    expect(romans).toEqual(ROMAN.slice(0, romans.length));
    // identification, revocation, pour-over, PR, debts, [guardian], final wishes, general
    expect(romans.length).toBe(minors ? 8 : 7);

    // sections restart at 1 inside each article and never skip
    const seen: Record<string, number[]> = {};
    for (const h of out.match(/^### Section \d+\.\d+ — /gm) ?? []) {
      const [article, section] = h.replace("### Section ", "").replace(" — ", "").split(".");
      (seen[article] ??= []).push(Number(section));
    }
    for (const [article, nums] of Object.entries(seen)) {
      expect(nums, `article ${article}`).toEqual(nums.map((_, i) => i + 1));
    }

    // Final Wishes sits where it was placed: after the guardian, before general
    expect(out.indexOf("— FINAL WISHES")).toBeLessThan(out.indexOf("— GENERAL PROVISIONS"));
    if (minors) {
      expect(out.indexOf("— GUARDIAN FOR MINOR CHILDREN")).toBeLessThan(out.indexOf("— FINAL WISHES"));
    }
  });

  it("no cross-reference dangles in any permutation", () => {
    for (const { choice, minors } of permutations) {
      const out = renderTemplate(POUR, data({
        funeralPreference: choice,
        hasMinorChildren: minors ? "Yes" : "No",
        ...(minors ? {} : { guardianName: "", guardianRelationship: "" }),
      }));
      expect(out).not.toContain("[[");
      expect(out).not.toContain("]]");
    }
  });
});

describe("the attorney's remains copy", () => {
  const by = (v: string) => FUNERAL_PREFERENCE_OPTIONS.find((o) => o.value === v)!;

  it("uses his descriptions verbatim", () => {
    expect(by("burial").description).toBe("I prefer to be buried.");
    expect(by("cremation").description).toBe("I prefer to be cremated.");
    expect(by("family_decides").description).toBe(
      "My Personal Representative shall make all decisions regarding my funeral, burial, and other final arrangements.",
    );
  });

  it("keeps the labels that were already approved", () => {
    expect(by("burial").label).toBe("Burial");
    expect(by("cremation").label).toBe("Cremation");
    expect(by("family_decides").label).toBe("Leave the decision to my Personal Representative");
  });

  it("drops the wording it replaced", () => {
    const all = JSON.stringify(FUNERAL_PREFERENCE_OPTIONS);
    expect(all).not.toContain("You would prefer your remains");
    expect(all).not.toContain("the person carrying out your will decides");
  });

  it("leaves the clause inside the documents untouched", () => {
    const d = data({ funeralPreference: "family_decides" });
    for (const tpl of [WILL, POUR]) {
      expect(renderTemplate(tpl, d)).toContain(
        "I leave the decision regarding the manner of disposition of my remains (whether burial, cremation, or other lawful method) to my Personal Representative.",
      );
    }
  });

  it("the review screens echo the label, so no row needs the new description", () => {
    for (const page of ["will", "trust"]) {
      const src = readFileSync(join(__dirname, "..", "..", "app", page, "page.tsx"), "utf8");
      expect(src).toContain('<Row label="Remains" value={FUNERAL_PREFERENCE_OPTIONS.find((o) => o.value === intake.funeralPreference)?.label ?? ""} />');
    }
  });
});

describe("the Pour-Over Will's signing steps are the attorney's", () => {
  const out = () => renderTemplate(POUR, data({ funeralPreference: "burial" }));

  it("matches the Will's sheet step for step", () => {
    const steps = (t: string) => t.match(/^STEP \d - .+$/gm) ?? [];
    const willSteps = steps(renderTemplate(WILL, data({ funeralPreference: "burial" })));
    const pourSteps = steps(out());
    expect(pourSteps).toEqual(willSteps);
    expect(pourSteps).toHaveLength(7);
  });

  it("carries his opening warning and the approved Step 5", () => {
    const o = out();
    expect(o).toContain("Important: To make this Will legally valid under Michigan law, you must follow each step below carefully.");
    expect(o).toContain("This Will includes a self-proving affidavit on its final pages.");
  });

  it("the affidavit Step 5 points at is in this document too", () => {
    const o = out();
    expect(o).toContain("SELF-PROVING AFFIDAVIT");
    expect(o.indexOf("SELF-PROVING AFFIDAVIT")).toBeLessThan(o.indexOf("STEP 5 -"));
  });

  it("replaced the development team's steps", () => {
    const o = out();
    for (const gone of [
      "STEP 1 - CHOOSE YOUR WITNESSES",
      "STEP 5 - COMPLETE THE NOTARY SECTION",
      "Sign and date this Will in the presence of both witnesses simultaneously.",
    ]) {
      expect(o).not.toContain(gone);
    }
  });

  it("carries its provenance in a comment and nothing in the document", () => {
    expect(POUR).toContain("approved for this document by email on 2026-09-14");
    expect(POUR).not.toContain("PENDING ATTORNEY APPROVAL");
    expect(out()).not.toContain("{{!--");
    expect(stripComments(POUR)).not.toContain("approved for this document by email");
  });

  it("restores the two points his steps did not carry", () => {
    const o = out();
    expect(o).toContain("Witnesses should not be beneficiaries under this Will or the companion Trust.");
    expect(o).toContain("Store your original signed Will together with your Ahmed Hassan Revocable Living Trust in a safe place");
    expect(o).toContain("where this original Will and the Trust are stored");
  });

  it("changes nothing else in his Step 6 and Step 7", () => {
    const o = out();
    expect(o).toContain("Do not store it where it might be damaged, lost, or mistaken for a draft. You may also upload a copy to your EstateVault account for safekeeping.");
    expect(o).toContain("Give them any password or access information they may need to locate it.");
  });
});
