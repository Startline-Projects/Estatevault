// BUG-20 fix verification — equal-shares residuary distribution.
//
// Before the fix, both templates emitted a per-head percentage for equal
// shares using `(100/n).toFixed(n===3?2:0)`, which only summed to 100% for
// n=3. n=6 → "17% each" (102%), n=7 → "14%" (98%), n=8 → "13%" (104%) — a
// wrong percentage injected verbatim into the Claude drafting prompt. The fix
// drops the fabricated percentage and instructs an equal division, letting the
// residuary clause split evenly. These tests assert NO per-head percentage is
// emitted for any count and the custom-percentage path still works.

import { describe, it, expect } from "vitest";
import { buildWillPrompt } from "@/lib/documents/templates/michigan-will";
import { buildTrustPrompt } from "@/lib/documents/templates/michigan-revocable-trust";
import { mapIntakeToTemplateData } from "@/lib/documents/intake-adapter";

const beneficiaries = (n: number) =>
  Array.from({ length: n }, (_, k) => ({ name: `Ben${k + 1}`, relationship: "child" }));

function equalShareIntake(n: number) {
  return {
    firstName: "Test",
    lastName: "Testator",
    beneficiariesEqualShares: "Yes",
    beneficiaries: beneficiaries(n),
  };
}

const builders: Array<[string, (i: Record<string, unknown>) => string]> = [
  ["will", buildWillPrompt],
  ["trust", buildTrustPrompt],
];

describe("BUG-20 — equal-shares residuary never emits a wrong percentage", () => {
  for (const [label, build] of builders) {
    // n=3 used to be the only "correct" case; 6/7/8 produced 102/98/104%.
    for (const n of [2, 3, 6, 7, 8]) {
      it(`${label}: ${n} equal beneficiaries → no per-head percentage`, () => {
        const prompt = build(equalShareIntake(n));
        // The defect: any "NN% each" string. Must not appear for equal shares.
        expect(prompt).not.toMatch(/\d+(\.\d+)?% each/);
        // And the distribution line must instruct an equal division.
        expect(prompt).toContain(`Equal shares — divided equally among all ${n} beneficiaries`);
      });
    }

    it(`${label}: custom percentages path is unchanged`, () => {
      const prompt = build({
        firstName: "Test",
        lastName: "Testator",
        beneficiariesEqualShares: "No",
        beneficiaries: [
          { name: "A", relationship: "child", share: "60" },
          { name: "B", relationship: "child", share: "40" },
        ],
      });
      expect(prompt).toContain("Custom percentages (see above)");
      expect(prompt).toContain("A (child) — 60%");
      expect(prompt).toContain("B (child) — 40%");
    });

    it(`${label}: single beneficiary still gets 100%`, () => {
      const prompt = build({
        firstName: "Test",
        lastName: "Testator",
        beneficiariesEqualShares: "Yes",
        beneficiaries: [{ name: "Solo", relationship: "spouse" }],
      });
      expect(prompt).toContain("100% to Solo");
    });
  }
});

// The react-pdf renderer (PDF_RENDERER=react-pdf, active in .env.local) does NOT
// use Claude for the will — it renders the will-michigan-v1.1.0 template, which
// prints "{{share_percent}}% to {{full_name}}" per beneficiary. The intake
// adapter computes those percentages. The same BUG-20 defect lived here as
// `Math.floor(100/count)`, which UNDERSHOOTS (3→99%, 6→96%). The fix uses a
// largest-remainder split that always sums to exactly 100%.
const sum = (arr: Array<{ share_percent: string }>) =>
  arr.reduce((s, b) => s + Number(b.share_percent), 0);

describe("BUG-20 — react-pdf intake adapter equal-share percentages sum to 100", () => {
  for (const n of [1, 2, 3, 6, 7, 8, 11]) {
    it(`${n} equal primary beneficiaries → percentages sum to exactly 100`, () => {
      const { data, error } = mapIntakeToTemplateData({
        beneficiaries: Array.from({ length: n }, (_, k) => ({ name: `B${k}`, relationship: "child" })),
        beneficiariesEqualShares: "Yes",
      });
      expect(error).toBeNull();
      expect(data!.primary_beneficiaries).toHaveLength(n);
      expect(sum(data!.primary_beneficiaries)).toBe(100);
    });

    it(`${n} equal contingent beneficiaries → percentages sum to exactly 100`, () => {
      const { data } = mapIntakeToTemplateData({
        contingentBeneficiaries: Array.from({ length: n }, (_, k) => ({ name: `C${k}`, relationship: "child" })),
        contingentEqualShares: "Yes",
      });
      expect(sum(data!.contingent_beneficiaries)).toBe(100);
    });
  }

  it("custom (non-equal) shares pass through unchanged", () => {
    const { data } = mapIntakeToTemplateData({
      beneficiaries: [
        { name: "A", relationship: "child", share: "70" },
        { name: "B", relationship: "child", share: "30" },
      ],
      beneficiariesEqualShares: "No",
    });
    expect(data!.primary_beneficiaries.map((b) => b.share_percent)).toEqual(["70", "30"]);
  });
});
