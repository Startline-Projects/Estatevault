/**
 * Prompt 9 acceptance sweeps.
 *
 *   D4 — no physician-examination / certification / written-statement language
 *        survives anywhere the springing power or the advocate's authority is
 *        described: template body, instruction sheet, or questionnaire.
 *   E  — no instruction sheet cites a statute.
 *
 * Note on scope: the attorney's own Advance Healthcare Directive text mentions
 * "the physicians treating me" and "attending physician" in the witness
 * disqualification list. Those are his words and stay. What is banned is the
 * language that made a physician's CERTIFICATE the trigger for authority.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const TEMPLATE_DIR = join(__dirname, "templates");
const TEMPLATES = readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith(".txt"));
const SHEET_MARKER = "## OPERATION OF THIS DOCUMENT";

const read = (f: string) => readFileSync(join(TEMPLATE_DIR, f), "utf8");
/**
 * The instruction sheet is the OPERATION block. In most templates it sits last,
 * but funeral-rep, guardian-nomination and hipaa still carry theirs at the top,
 * so it ends at the next "## " heading rather than at end of file. Slicing to
 * EOF would sweep operative articles — whose citations must stay — into the
 * sheet.
 */
const sheetOf = (s: string) => {
  const i = s.indexOf(SHEET_MARKER);
  if (i === -1) return "";
  const rest = s.slice(i + SHEET_MARKER.length);
  const next = rest.search(/\n## /);
  return next === -1 ? s.slice(i) : s.slice(i, i + SHEET_MARKER.length + next);
};

/** Phrases that make a physician's certificate the trigger for authority. */
const CERTIFICATION_PATTERNS: Array<[string, RegExp]> = [
  ["physician certifies/certified", /physician[^.]{0,80}certif/i],
  ["certified in writing", /certified in writing/i],
  ["physician's certification", /physician'?s certification/i],
  ["examined me and certified", /examined me[^.]{0,40}certif/i],
  ["must examine you", /physician must examine you/i],
  ["signs a new statement", /physician signs a new statement/i],
  ["licensed to practice medicine", /licensed to practice medicine/i],
  ["written statement of incapacity", /written statement saying that you are unable/i],
];

describe("D4 — physician certification language is gone", () => {
  it.each(TEMPLATES)("%s carries none", (file) => {
    const text = read(file);
    for (const [label, re] of CERTIFICATION_PATTERNS) {
      expect(re.test(text), `${file}: ${label}`).toBe(false);
    }
  });

  it("the questionnaire describes the springing trigger as incapacity", () => {
    const step = readFileSync(join(__dirname, "..", "..", "components", "intake", "PoaPadSteps.tsx"), "utf8");
    for (const [label, re] of CERTIFICATION_PATTERNS) {
      expect(re.test(step), `PoaPadSteps: ${label}`).toBe(false);
    }
    expect(step).toContain("deemed incapacitated");
  });

  it("the legacy pdf-lib sheets say the same thing", () => {
    const legacy = readFileSync(join(__dirname, "instruction-sheets.ts"), "utf8");
    for (const [label, re] of CERTIFICATION_PATTERNS) {
      expect(re.test(legacy), `instruction-sheets: ${label}`).toBe(false);
    }
    expect(legacy).toContain("deemed incapacitated");
  });

  it("the springing branch triggers simply on incapacity", () => {
    const dpoa = read("dpoa-michigan-v1.1.0.txt");
    expect(dpoa).toContain("shall not become effective unless and until I am deemed incapacitated");
  });

  it("keeps the attorney's own wording that merely mentions physicians", () => {
    const ahcd = read("advance-healthcare-directive-michigan-v1.0.0.txt");
    expect(ahcd).toContain("any information from the physicians treating me");
    expect(ahcd).toContain("attending physician");
  });
});

describe("E — no instruction sheet cites a statute", () => {
  it.each(TEMPLATES)("%s sheet is citation-free", (file) => {
    const sheet = sheetOf(read(file));
    if (!sheet) return;
    expect(sheet).not.toMatch(/MCL/);
    expect(sheet).not.toMatch(/M\.C\.L\./);
    expect(sheet).not.toMatch(/Mich\. Comp\. Laws/);
  });

  it("the legacy pdf-lib sheets are citation-free", () => {
    expect(readFileSync(join(__dirname, "instruction-sheets.ts"), "utf8")).not.toMatch(/MCL/);
  });

  it("citations inside operative articles are untouched", () => {
    // The rule is sheets only; the instruments must keep their law.
    const will = read("will-michigan-v1.1.0.txt");
    const body = will.slice(0, will.indexOf(SHEET_MARKER));
    expect(body).toMatch(/MCL/);
    const ahcd = read("advance-healthcare-directive-michigan-v1.0.0.txt");
    expect(ahcd.slice(0, ahcd.indexOf(SHEET_MARKER))).toMatch(/MCL 700\.5507/);
  });
});

describe("D2 — gift-making and estate-plan amendment are no longer offered", () => {
  it("neither power appears in the DPOA template", () => {
    const dpoa = read("dpoa-michigan-v1.1.0.txt");
    expect(dpoa).not.toContain("gift_making");
    expect(dpoa).not.toContain("amend_estate_plan");
    expect(dpoa).not.toContain("Gift-Making Authority");
    expect(dpoa).not.toContain("Authority to Make Changes to Estate Plan");
  });

  it("neither appears in the offered power list", async () => {
    const { ALL_POA_POWERS } = await import("@/components/intake/PoaPadSteps");
    expect(ALL_POA_POWERS).toEqual([
      "Banking and finances",
      "Real estate transactions",
      "Business operations",
      "Tax filings",
    ]);
    for (const p of ALL_POA_POWERS) {
      expect(p).not.toMatch(/gift/i);
      expect(p).not.toMatch(/estate plan/i);
    }
  });
});

describe("B3 — the two medical preference questions no longer exist", () => {
  it("are absent from the shared step, both flows and validation", () => {
    const files = [
      join(__dirname, "..", "..", "components", "intake", "PoaPadSteps.tsx"),
      join(__dirname, "..", "..", "app", "will", "page.tsx"),
      join(__dirname, "..", "..", "app", "trust", "page.tsx"),
      join(__dirname, "..", "validation", "schemas.ts"),
      join(__dirname, "intake-adapter.ts"),
    ];
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/lifeSustainingTreatment|life_sustaining_treatment_preference/);
      expect(s, f).not.toMatch(/artificialNutrition|artificial_nutrition_preference/);
    }
  });

  it("no DNR question was added — the document's language is fixed text", () => {
    const step = readFileSync(join(__dirname, "..", "..", "components", "intake", "PoaPadSteps.tsx"), "utf8");
    expect(step).not.toMatch(/DNR|Do Not Resuscitate/i);
    // and the directive carries it as the attorney wrote it
    expect(read("advance-healthcare-directive-michigan-v1.0.0.txt"))
      .toContain("Do Not Resuscitate (DNR) orders");
  });
});

describe("C — advocate_decides is gone everywhere", () => {
  it("no template branches on it", () => {
    for (const f of TEMPLATES) expect(read(f), f).not.toContain("advocate_decides");
  });

  it("no questionnaire or schema offers it", () => {
    for (const f of [
      join(__dirname, "..", "..", "components", "intake", "PoaPadSteps.tsx"),
      join(__dirname, "..", "validation", "schemas.ts"),
    ]) {
      expect(readFileSync(f, "utf8"), f).not.toContain("advocate_decides");
    }
  });
});
