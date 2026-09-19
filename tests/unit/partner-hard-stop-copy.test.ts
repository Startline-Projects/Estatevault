/**
 * Partner-facing pages must promise exactly the hard stops the platform enforces.
 *
 * These pages tell attorneys and partners which client situations halt document
 * generation and get routed to them. That is a claim about behaviour, so it has
 * to match lib/compliance/hardStop.ts. It drifted twice: in September 2026 the
 * pages named "business succession", which nothing ever enforced, and then
 * "irrevocable trust" after that stop was removed (2026-09-18). The before and
 * after of every change is recorded in docs/HARD_STOP_COPY_CHANGE.md.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { HARD_STOP_REASONS } from "@/lib/compliance/hardStop";

const ROOT = join(__dirname, "..", "..");

/** Source text as it reads on the page: JSX line breaks collapse to one space. */
const rendered = (file: string) =>
  readFileSync(join(ROOT, file), "utf8").replace(/&apos;/g, "'").replace(/\s+/g, " ");

const LANDING = ["app/partners/attorneys/page.tsx", "app/khan-lawgroup/page.tsx"];

const PROMISES: Array<{ files: string[]; sentence: string }> = [
  {
    files: LANDING,
    sentence:
      "If a client's intake indicates a special-needs dependent, Medicaid planning, or an active estate dispute, the platform halts document generation and flags the case directly to you for a full engagement.",
  },
  { files: LANDING, sentence: "Special-needs dependents, Medicaid planning, estate disputes, flagged to you." },
  {
    files: LANDING,
    sentence:
      "When a client's situation involves a special-needs dependent, Medicaid planning, or an active estate dispute, the platform flags the case and routes it directly to you.",
  },
  {
    files: ["app/pro/support/page.tsx"],
    sentence:
      "If a client indicates a special-needs dependent, Medicaid planning, or an active estate dispute, document generation halts automatically.",
  },
  {
    files: ["app/pro/referrals/page.tsx"],
    sentence:
      "When a client triggers a hard stop (a special-needs dependent, Medicaid planning, or an active estate dispute), they are automatically routed to an attorney.",
  },
];

describe("partner copy names the three hard stops the platform enforces", () => {
  it("the evaluator has exactly those three", () => {
    expect(Object.values(HARD_STOP_REASONS)).toEqual([
      "Special-needs dependent",
      "Medicaid planning",
      "Active estate dispute",
    ]);
  });

  const cases = PROMISES.flatMap(({ files, sentence }) => files.map((f) => [f, sentence] as const));

  it.each(cases)("%s — %s", (file, sentence) => {
    expect(rendered(file)).toContain(sentence);
  });
});

describe("irrevocable trust is not promised as a hard stop", () => {
  it.each(["app/pro/support/page.tsx", "app/pro/referrals/page.tsx"])("%s does not mention it", (file) => {
    expect(rendered(file)).not.toMatch(/irrevocable/i);
  });

  it.each(LANDING)("%s mentions it only as an engagement-pricing row", (file) => {
    const src = readFileSync(join(ROOT, file), "utf8");
    const mentions = src.split("\n").filter((l) => /irrevocable/i.test(l)).map((l) => l.trim());
    // Engagement pricing is a separate claim: an attorney can still be hired to
    // draft one. It is not a promise that the platform stops and routes the case.
    expect(mentions).toEqual(["{ t: 'Irrevocable Trust', p: '$3,500 to $7,500' },"]);
  });
});
