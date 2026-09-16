/**
 * Prompt 10C — the engagement closes with nothing outstanding.
 *
 * These are record-keeping assertions rather than rendering ones: they fail if
 * a review marker outlives its approval, or if the review file starts claiming
 * something it cannot back up.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { stripComments } from "./render-template";
import { computeDerivedFields } from "./computed-fields";
import { initialTemplateWillIntake } from "./intake-adapter";
import { join } from "path";

const ROOT = join(__dirname, "..", "..");
const TEMPLATE_DIR = join(__dirname, "templates");
const REVIEW = readFileSync(join(ROOT, "PENDING_ATTORNEY_REVIEW.md"), "utf8");

/** Everything between two top-level headings. */
function section(heading: string): string {
  const start = REVIEW.indexOf(`## ${heading}`);
  expect(start, `missing section: ${heading}`).toBeGreaterThan(-1);
  const next = REVIEW.indexOf("\n## ", start + 1);
  return REVIEW.slice(start, next === -1 ? undefined : next);
}

const entries = (s: string) => (s.match(/^### /gm) ?? []).length;

describe("the review queue is empty", () => {
  it("holds only the hard-stop question wording, reopened after the close", () => {
    const pending = section("Still pending review");
    expect(entries(pending)).toBe(1);
    expect(pending).toContain("### Questionnaire — hard-stop questions");
  });

  it("the status table agrees with the entries actually filed", () => {
    expect(REVIEW).toContain("| Entries awaiting review | 1 — the hard-stop question wording |");
    expect(entries(section("APPROVED — 2026-09-13"))).toBe(27);
    expect(REVIEW).toContain("| Approved | 5 entries on 2026-09-14 · 27 on 2026-09-13 · 47 on 2026-09-02 |");
    expect(entries(section("APPROVED — 2026-09-14"))).toBe(5);
    expect(entries(section("APPROVED — 2026-09-02"))).toBe(47);
    expect(entries(section("Withdrawn"))).toBe(2);
  });

  it("the strings written after his last package are filed as approved, not left outside the counts", () => {
    expect(REVIEW).not.toContain("not yet put to the attorney");
    const approved = section("APPROVED — 2026-09-14");
    for (const s of [
      "Are you creating this trust jointly with your spouse or partner?",
      "Their full name",
      "Second grantor",
      "Donation purposes",
      "Example: transplantation and therapy only.",
      "Where you chose a springing power",
    ]) {
      expect(approved, s).toContain(s);
    }
  });

  it("says what the approval rests on", () => {
    expect(REVIEW).toContain("# Attorney Review Record —");
    expect(REVIEW).toContain("| Approval on file | blanket email from Mo Murshed, 2026-09-14 |");
  });

  it("its code fences are balanced, so every entry renders as written", () => {
    expect((REVIEW.match(/^```/gm) ?? []).length % 2).toBe(0);
  });
});

describe("no approved wording still calls itself pending", () => {
  it("no template carries a pending marker", () => {
    for (const f of readdirSync(TEMPLATE_DIR).filter((n) => n.endsWith(".txt"))) {
      expect(readFileSync(join(TEMPLATE_DIR, f), "utf8"), f).not.toContain("PENDING ATTORNEY APPROVAL");
    }
  });

  it("the only questionnaire component marked pending is the one with an open entry", () => {
    const dir = join(ROOT, "components", "intake");
    const marked = readdirSync(dir)
      .filter((n) => n.endsWith(".tsx"))
      .filter((f) => readFileSync(join(dir, f), "utf8").includes("PENDING ATTORNEY APPROVAL"));
    expect(marked).toEqual(["HardStopQuestions.tsx"]);
    // and that marker has a matching entry in the file
    expect(section("Still pending review")).toContain("HardStopQuestions.tsx");
  });

  it("the reopening is explained in the header, not just in the table", () => {
    expect(REVIEW).toContain("Reopened 2026-09-15");
    expect(REVIEW).toContain("anything client-facing written after the close goes back to him");
  });

  it("no questionnaire page still says a string is unreviewed", () => {
    const page = readFileSync(join(ROOT, "app", "trust", "page.tsx"), "utf8");
    expect(page).not.toContain("NOT YET PUT TO THE ATTORNEY");
    expect(page).not.toContain("PENDING ATTORNEY APPROVAL");
  });
});

describe("the record matches what the documents say", () => {
  it("the item 6 clause is quoted as it renders, not as it once read", () => {
    const will = readFileSync(join(TEMPLATE_DIR, "will-michigan-v1.1.0.txt"), "utf8");
    const clause =
      "I leave the decision regarding the manner of disposition of my remains " +
      "(whether burial, cremation, or other lawful method) to my Personal Representative.";
    expect(will).toContain(clause);
    expect(REVIEW).toContain(clause);
    expect(will).not.toContain("in consultation with my surviving family members");
  });

  it("the approved Step 5 in the file is the Step 5 in the Will", () => {
    const will = readFileSync(join(TEMPLATE_DIR, "will-michigan-v1.1.0.txt"), "utf8");
    const step5 =
      "This Will includes a self-proving affidavit on its final pages. You, your witnesses, " +
      "and the notary complete it during the same signing session. This makes it easier for " +
      "your Personal Representative to probate your Will without requiring witness testimony later.";
    expect(will).toContain(step5);
    expect(REVIEW).toContain(step5);
  });
});

describe("the citation sweep left nothing broken behind it", () => {
  const TEMPLATES = readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith(".txt"));

  /** Wounds the sweep left when it cut a citation out of a sentence. */
  const SCARS: Array<[string, RegExp]> = [
    ["two sentences fused", /\b(law|Act|Code|EPIC|seq|statute|Designation)\s+(and\s+)?(It|This|They|Your|You|The)\b/],
    ["separator with nothing between", /·\s*·/],
    ["qualifier with nothing to qualify", /·\s*\([a-z][^)]*\)/],
    ["empty parentheses", /\(\s*\)/],
  ];

  it.each(TEMPLATES)("%s carries none of them", (file) => {
    const text = stripComments(readFileSync(join(TEMPLATE_DIR, file), "utf8"));
    for (const [label, re] of SCARS) {
      const line = text.split("\n").find((l) => re.test(l));
      expect(line, `${file}: ${label}`).toBeUndefined();
    }
  });

  it("no sentence is left holding an unmatched closing bracket", () => {
    for (const file of TEMPLATES) {
      for (const line of stripComments(readFileSync(join(TEMPLATE_DIR, file), "utf8")).split("\n")) {
        const opens = (line.match(/\(/g) ?? []).length;
        const closes = (line.match(/\)/g) ?? []).length;
        expect(closes, `${file}: ${line.slice(0, 90)}`).toBeLessThanOrEqual(opens);
      }
    }
  });
});

describe("a trust is named once, not twice", () => {
  it("no template writes an article in front of a name that carries its own", () => {
    for (const f of readdirSync(TEMPLATE_DIR).filter((n) => n.endsWith(".txt"))) {
      const text = readFileSync(join(TEMPLATE_DIR, f), "utf8");
      expect(text, f).not.toMatch(/\b(the|your|The|Your) \{\{trust_name_display\}\}/);
    }
  });

  it("strips the client's own leading article for those positions", () => {
    const named = computeDerivedFields({ ...initialTemplateWillIntake, trust_name: "The Hassan Family Trust" });
    expect(named.trust_name_display).toBe("The Hassan Family Trust");
    expect(named.trust_name_bare).toBe("Hassan Family Trust");
    const unnamed = computeDerivedFields({ ...initialTemplateWillIntake, first_name: "Ahmed", last_name: "Hassan" });
    expect(unnamed.trust_name_display).toBe("The Ahmed Hassan Revocable Living Trust");
    expect(unnamed.trust_name_bare).toBe("Ahmed Hassan Revocable Living Trust");
  });

  it("leaves a name that has no article alone", () => {
    expect(computeDerivedFields({ ...initialTemplateWillIntake, trust_name: "Hassan Family Trust" }).trust_name_bare)
      .toBe("Hassan Family Trust");
  });
});
