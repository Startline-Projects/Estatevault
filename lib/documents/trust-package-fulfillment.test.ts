/**
 * The Trust Package fulfillment gap.
 *
 * The templates for the Certification of Trust, the Assignments and the Funding
 * Instructions have rendered correctly since they were written, but the webhook
 * hardcoded four document types for a trust order, so rows for the other four
 * were never created — and the status route measured completeness against the
 * rows that existed, so a half-delivered package reported "complete".
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  expectedDocumentTypes,
  isJointTrustIntake,
  trustPackageDocumentTypes,
  checkTrustPackageComplete,
} from "./trust-package";
import { mapIntakeToTemplateData } from "./intake-adapter";

const JOINT = {
  isJointTrust: "Yes",
  secondGrantorName: "Raga Hassan",
  secondGrantorRelationship: "Spouse/Partner",
  jointTrusteeAuthority: "jointly",
};
const SINGLE = { isJointTrust: "No", secondGrantorName: "" };

describe("a trust order creates a row for every document it owes", () => {
  it("joint trust: eight types, both assignments", () => {
    const types = expectedDocumentTypes("trust", JOINT);
    expect(types).toHaveLength(8);
    expect(types).toEqual([
      "trust",
      "certification_of_trust",
      "assignment_personal_property_g1",
      "assignment_personal_property_g2",
      "pour_over_will",
      "trust_funding_instructions",
      "poa",
      "healthcare_directive",
    ]);
  });

  it("single-grantor trust: seven types, one assignment", () => {
    const types = expectedDocumentTypes("trust", SINGLE);
    expect(types).toHaveLength(7);
    expect(types).toContain("assignment_personal_property_g1");
    expect(types).not.toContain("assignment_personal_property_g2");
  });

  it("will package is unchanged at three", () => {
    expect(expectedDocumentTypes("will", {})).toEqual(["will", "poa", "healthcare_directive"]);
  });

  it("a trust with no intake at all is treated as single-grantor, not joint", () => {
    // Fail toward the smaller set: a spurious g2 row would block the order,
    // and an order with no intake has bigger problems than a missing row.
    expect(expectedDocumentTypes("trust", null)).toHaveLength(7);
    expect(expectedDocumentTypes("trust", {})).toHaveLength(7);
  });
});

describe("joint detection agrees with the adapter", () => {
  // If these two ever disagree an order creates the wrong number of rows: too
  // few and the package is short, too many and g2 blocks the order forever.
  const CASES: Array<[string, Record<string, unknown>]> = [
    ["explicit joint with a name", JOINT],
    ["explicit single", SINGLE],
    ["joint answered Yes but no name given", { isJointTrust: "Yes", secondGrantorName: "" }],
    ["name present, question never answered", { secondGrantorName: "Raga Hassan" }],
    ["No overrides a stale name", { isJointTrust: "No", secondGrantorName: "Raga Hassan" }],
    ["nothing answered", {}],
    ["lowercase yes", { isJointTrust: "yes", secondGrantorName: "" }],
  ];

  it.each(CASES)("%s", (_label, intake) => {
    const base = {
      firstName: "Ahmed", lastName: "Hassan", city: "Dearborn", state: "Michigan",
      successorTrusteeName: "Karim Hassan", successorTrusteeRelationship: "Sibling",
      executorName: "Raga Hassan", organDonation: "silent", funeralPreference: "burial",
      beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "", contingency: "descendants" }],
      ...intake,
    };
    const adapterSaysJoint = mapIntakeToTemplateData(base).data!.is_joint_trust;
    expect(isJointTrustIntake(base)).toBe(adapterSaysJoint);
  });

  it("reads the snake_case shape the webhook gets off a stored order", () => {
    expect(isJointTrustIntake({ grantor_2_full_name: "Raga Hassan" })).toBe(true);
    expect(isJointTrustIntake({ is_joint_trust: true })).toBe(true);
    expect(isJointTrustIntake({ is_joint_trust: false })).toBe(false);
  });
});

describe("the completeness gate holds until the package is whole", () => {
  it("a joint trust missing the second assignment is incomplete", () => {
    const result = checkTrustPackageComplete(true, trustPackageDocumentTypes(true).slice(0, -1));
    expect(result.complete).toBe(false);
  });

  it("holds a joint order that produced only the old four types", () => {
    const old = ["trust", "pour_over_will", "poa", "healthcare_directive"];
    const result = checkTrustPackageComplete(true, old);
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual([
      "certification_of_trust",
      "assignment_personal_property_g1",
      "assignment_personal_property_g2",
      "trust_funding_instructions",
    ]);
  });

  it("passes once all eight exist", () => {
    expect(checkTrustPackageComplete(true, trustPackageDocumentTypes(true)).complete).toBe(true);
  });

  it("does not demand a second assignment from a single-grantor trust", () => {
    expect(checkTrustPackageComplete(false, trustPackageDocumentTypes(false)).complete).toBe(true);
  });
});

describe("the wiring is actually in the fulfillment path", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

  it("the webhook asks for the expected set instead of a hardcoded four", () => {
    const src = read("lib/webhooks/stripe/handleDocumentCheckout.ts");
    expect(src).toContain("expectedDocumentTypes(productType, intakeForStop)");
    expect(src).not.toContain('? ["trust", "pour_over_will", "poa", "healthcare_directive"]');
  });

  it("the status route measures against what the order owes", () => {
    const src = read("app/api/documents/status/route.ts");
    expect(src).toContain("expectedDocumentTypes(");
    expect(src).toContain("missingTypes");
    // completeness can no longer be true while a type is missing
    expect(src).toContain("missingTypes.length === 0 && documents.every(ready)");
  });

  it("every expected type is permitted by the widened CHECK", () => {
    const migration = read("supabase/migrations/20260916_000_trust_package_document_types.sql");
    const all = Array.from(new Set(expectedDocumentTypes("trust", JOINT).concat(expectedDocumentTypes("will", {}))));
    for (const t of all) {
      expect(migration, t).toContain(`'${t}'`);
    }
  });

  it("every expected type has a template the renderer can find", () => {
    const map = read("lib/documents/pdf/doc-type-map.ts");
    for (const t of expectedDocumentTypes("trust", JOINT)) {
      expect(map, t).toContain(`${t}:`);
    }
  });
});
