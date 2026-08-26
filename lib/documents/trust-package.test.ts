import { describe, it, expect } from "vitest";
import { trustPackageDocumentTypes, checkTrustPackageComplete } from "./trust-package";

describe("Trust Package contents", () => {
  it("a single-grantor package carries one assignment", () => {
    const types = trustPackageDocumentTypes(false);
    expect(types).toContain("assignment_personal_property_g1");
    expect(types).not.toContain("assignment_personal_property_g2");
  });

  it("a joint package carries one assignment per grantor", () => {
    const types = trustPackageDocumentTypes(true);
    expect(types).toContain("assignment_personal_property_g1");
    expect(types).toContain("assignment_personal_property_g2");
  });

  it("delivers in the order the attorney specified", () => {
    const types = trustPackageDocumentTypes(true);
    const idx = (t: string) => types.indexOf(t);
    expect(idx("trust")).toBeLessThan(idx("certification_of_trust"));
    expect(idx("certification_of_trust")).toBeLessThan(idx("assignment_personal_property_g1"));
    expect(idx("assignment_personal_property_g1")).toBeLessThan(idx("assignment_personal_property_g2"));
    expect(idx("assignment_personal_property_g2")).toBeLessThan(idx("pour_over_will"));
    expect(idx("pour_over_will")).toBeLessThan(idx("trust_funding_instructions"));
  });
});

describe("completeness", () => {
  const single = trustPackageDocumentTypes(false);
  const joint = trustPackageDocumentTypes(true);

  it("a complete single-grantor order passes", () => {
    expect(checkTrustPackageComplete(false, single)).toEqual({ complete: true, missing: [] });
  });

  it("a joint order with only one assignment is incomplete", () => {
    const result = checkTrustPackageComplete(true, single);
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(["assignment_personal_property_g2"]);
  });

  it("a complete joint order passes", () => {
    expect(checkTrustPackageComplete(true, joint)).toEqual({ complete: true, missing: [] });
  });

  it("names everything that is missing, not just the first", () => {
    const result = checkTrustPackageComplete(true, ["trust", "pour_over_will"]);
    expect(result.missing).toEqual([
      "certification_of_trust",
      "assignment_personal_property_g1",
      "assignment_personal_property_g2",
      "trust_funding_instructions",
      "poa",
      "healthcare_directive",
    ]);
  });

  it("a single-grantor order is not asked for the second assignment", () => {
    expect(checkTrustPackageComplete(false, single).missing).toEqual([]);
  });
});
