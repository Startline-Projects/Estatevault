import { describe, it, expect } from "vitest";
import {
  beneficiaryFingerprint,
  canonicalBeneficiaries,
  checkPourOverStaleness,
  assertPourOverMatchesTrust,
} from "./staleness";

const TWO = [
  { full_name: "Ahmed Junior", share_percent: "50" },
  { full_name: "Raga Hassan", share_percent: "50" },
];

describe("fingerprint covers exactly what Section 3.3 renders", () => {
  it("is stable for identical input", () => {
    expect(beneficiaryFingerprint(TWO)).toBe(beneficiaryFingerprint([...TWO]));
  });

  it("changes when a share changes", () => {
    const edited = [{ ...TWO[0], share_percent: "70" }, { ...TWO[1], share_percent: "30" }];
    expect(beneficiaryFingerprint(edited)).not.toBe(beneficiaryFingerprint(TWO));
  });

  it("changes when a name changes", () => {
    const edited = [{ ...TWO[0], full_name: "Ahmed Junior II" }, TWO[1]];
    expect(beneficiaryFingerprint(edited)).not.toBe(beneficiaryFingerprint(TWO));
  });

  it("changes when a beneficiary is added or removed", () => {
    expect(beneficiaryFingerprint([TWO[0]])).not.toBe(beneficiaryFingerprint(TWO));
    expect(beneficiaryFingerprint([...TWO, { full_name: "Layla Hassan", share_percent: "0" }]))
      .not.toBe(beneficiaryFingerprint(TWO));
  });

  it("changes when the order changes, because Section 3.3 lists them in order", () => {
    expect(beneficiaryFingerprint([TWO[1], TWO[0]])).not.toBe(beneficiaryFingerprint(TWO));
  });

  it("ignores whitespace noise", () => {
    const noisy = [{ full_name: "  Ahmed   Junior ", share_percent: " 50 " }, TWO[1]];
    expect(beneficiaryFingerprint(noisy)).toBe(beneficiaryFingerprint(TWO));
  });

  it("stores no recoverable client name", () => {
    const fp = beneficiaryFingerprint(TWO);
    expect(fp).toMatch(/^[0-9a-f]{32}$/);
    expect(fp).not.toContain("Ahmed");
    expect(fp).not.toContain("Hassan");
    expect(canonicalBeneficiaries(TWO)).toContain("Ahmed Junior"); // the input does; the digest does not
  });
});

describe("staleness verdict", () => {
  it("is not stale when the fingerprint still matches", () => {
    expect(checkPourOverStaleness(beneficiaryFingerprint(TWO), TWO)).toEqual({ stale: false });
  });

  it("is stale when shares were edited afterwards", () => {
    const recorded = beneficiaryFingerprint(TWO);
    const edited = [{ ...TWO[0], share_percent: "70" }, { ...TWO[1], share_percent: "30" }];
    const verdict = checkPourOverStaleness(recorded, edited);
    expect(verdict.stale).toBe(true);
    expect(verdict.stale && verdict.reason).toContain("no longer matches the trust");
  });

  it("treats a document with no recorded fingerprint as stale, not as current", () => {
    const verdict = checkPourOverStaleness(null, TWO);
    expect(verdict.stale).toBe(true);
    expect(verdict.stale && verdict.reason).toContain("cannot be shown to match");
  });
});

describe("generation-time guard", () => {
  it("passes when both documents read the same list", () => {
    expect(() => assertPourOverMatchesTrust(TWO, [...TWO])).not.toThrow();
  });

  it("throws, naming both lists, when they diverge", () => {
    expect(() => assertPourOverMatchesTrust(TWO, [TWO[0]])).toThrow(/different beneficiary lists/);
  });
});
