/**
 * Prompt 5 — article auto-numbering with symbolic cross-references.
 *
 * Hardcoded numerals meant a conditional article left a hole. These tests pin
 * the engine's behaviour and then assert contiguous numbering in every
 * conditional permutation of the two instruments that use it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { assignNumbering, toRoman } from "./article-numbering";
import { renderTemplate } from "./render-template";
import { mapIntakeToTemplateData, type TemplateWillIntake } from "./intake-adapter";

const DIR = join(__dirname, "templates");
const WILL = readFileSync(join(DIR, "will-michigan-v1.1.0.txt"), "utf8");
const TRUST = readFileSync(join(DIR, "trust-michigan-v1.1.0.txt"), "utf8");

describe("the engine", () => {
  it("converts to roman numerals", () => {
    expect([1, 4, 5, 9, 10, 13, 14, 40].map(toRoman)).toEqual(
      ["I", "IV", "V", "IX", "X", "XIII", "XIV", "XL"],
    );
  });

  it("numbers articles by render order, not declaration order", () => {
    const { text } = assignNumbering("[[ARTICLE:b]] then [[ARTICLE:a]]");
    expect(text).toBe("I then II");
  });

  it("numbers sections within their own article", () => {
    const { text } = assignNumbering(
      "[[ARTICLE:a]] [[SECTION:a.x]] [[SECTION:a.y]] [[ARTICLE:b]] [[SECTION:b.x]]",
    );
    expect(text).toBe("I 1.1 1.2 II 2.1");
  });

  it("resolves cross-references to whatever the numeral turned out to be", () => {
    const { text } = assignNumbering(
      "[[ARTICLE:a]] [[ARTICLE:b]] [[SECTION:b.k]] see Article [[REF:b]] and Section [[REF:b.k]]",
    );
    expect(text).toBe("I II 2.1 see Article II and Section 2.1");
  });

  it("keeps references correct when an earlier article drops out", () => {
    const withGifts = assignNumbering("[[ARTICLE:gifts]] [[ARTICLE:dist]] see [[REF:dist]]").text;
    const without = assignNumbering("[[ARTICLE:dist]] see [[REF:dist]]").text;
    expect(withGifts).toBe("I II see II");
    expect(without).toBe("I see I");
  });

  it("refuses to emit a dangling reference", () => {
    expect(() => assignNumbering("[[ARTICLE:a]] see [[REF:ghost]]")).toThrow(/did not render/);
  });

  it("refuses a section whose article did not render", () => {
    expect(() => assignNumbering("[[SECTION:ghost.s1]]")).toThrow(/cannot outlive its article/);
  });
});

// ── permutation matrix ───────────────────────────────────────────────────────

function intake(overrides: Partial<TemplateWillIntake>): TemplateWillIntake {
  const r = mapIntakeToTemplateData({
    firstName: "Ahmed",
    lastName: "Hassan",
    city: "Dearborn",
    executorName: "Raga Hassan",
    executorRelationship: "Spouse/Partner",
    successorTrusteeName: "Raga Hassan",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "", contingency: "other_beneficiaries" }],
    guardianName: "Karim Hassan",
  });
  return { ...r.data!, ...overrides } as TemplateWillIntake;
}

function articlesOf(template: string, data: TemplateWillIntake): string[] {
  return (renderTemplate(template, data).match(/## ARTICLE ([IVXLCDM]+) —/g) ?? [])
    .map((h) => h.replace("## ARTICLE ", "").replace(" —", ""));
}

const EXPECTED = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII"];

function assertContiguous(numerals: string[]) {
  expect(numerals).toEqual(EXPECTED.slice(0, numerals.length));
}

describe("will: contiguous numbering in every permutation", () => {
  for (const minors of [true, false]) {
    for (const gifts of [true, false]) {
      it(`minor children ${minors}, specific gifts ${gifts}`, () => {
        const data = intake({
          has_minor_children: minors,
          has_specific_gifts: gifts,
          specific_gifts: gifts
            ? [{ item_description: "a watch", recipient_full_name: "Omar Hassan", recipient_relationship: "son", fallback: "residuary" }]
            : [],
        });
        const numerals = articlesOf(WILL, data);
        assertContiguous(numerals);
        expect(numerals).toHaveLength(minors ? 10 : 9);
      });
    }
  }

  it("the guardian article is the one that disappears", () => {
    const withKids = renderTemplate(WILL, intake({ has_minor_children: true }));
    const without = renderTemplate(WILL, intake({ has_minor_children: false }));
    expect(withKids).toContain("GUARDIAN FOR MINOR CHILDREN");
    expect(without).not.toContain("GUARDIAN FOR MINOR CHILDREN");
  });
});

describe("trust: contiguous numbering in every permutation", () => {
  for (const gifts of [true, false]) {
    for (const minors of [true, false]) {
      for (const backup of [true, false]) {
        it(`gifts ${gifts}, minor children ${minors}, backup trustee ${backup}`, () => {
          const data = intake({
            has_specific_gifts: gifts,
            specific_gifts: gifts
              ? [{ item_description: "a watch", recipient_full_name: "Omar Hassan", recipient_relationship: "son", fallback: "residuary" }]
              : [],
            has_minor_children: minors,
            second_successor_trustee: backup
              ? { full_name: "Karim Hassan", relationship: "Sibling", city: "Dearborn", state: "Michigan" }
              : null,
          });
          assertContiguous(articlesOf(TRUST, data));
        });
      }
    }
  }

  it("Article VI is Specific Gifts when there are gifts and Distribution when there are not", () => {
    const withGifts = renderTemplate(TRUST, intake({
      has_specific_gifts: true,
      specific_gifts: [{ item_description: "a watch", recipient_full_name: "Omar Hassan", recipient_relationship: "son", fallback: "residuary" }],
    }));
    const without = renderTemplate(TRUST, intake({ has_specific_gifts: false, specific_gifts: [] }));

    expect(withGifts).toContain("## ARTICLE VI — SPECIFIC GIFTS");
    expect(withGifts).toContain("## ARTICLE VII — DISTRIBUTION OF TRUST ESTATE");
    expect(without).toContain("## ARTICLE VI — DISTRIBUTION OF TRUST ESTATE");
    expect(without).not.toContain("SPECIFIC GIFTS");
  });

  it("sections stay contiguous when the backup trustee drops out", () => {
    const without = renderTemplate(TRUST, intake({ second_successor_trustee: null }));
    const secs = (without.match(/### Section (3\.\d+) —/g) ?? []).map((x) => x.replace(/\D*(3\.\d+).*/, "$1"));
    expect(secs).toEqual(["3.1", "3.2", "3.3", "3.4", "3.5"]);
  });
});
