/**
 * Prompt 9B — the funeral preference question and the joint co-trustee choice.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderTemplate } from "./render-template";
import { mapIntakeToTemplateData, validateForDocument } from "./intake-adapter";
import { findResumePoint } from "@/lib/intake/incomplete-steps";

const WILL = readFileSync(join(__dirname, "templates", "will-michigan-v1.1.0.txt"), "utf8");
const TRUST = readFileSync(join(__dirname, "templates", "trust-michigan-v1.1.0.txt"), "utf8");

function answers(o: Record<string, unknown> = {}) {
  return {
    firstName: "Ahmed", lastName: "Hassan", city: "Dearborn", state: "Michigan",
    executorName: "Raga Hassan", executorRelationship: "Spouse/Partner",
    successorTrusteeName: "Karim Hassan", successorTrusteeRelationship: "Sibling",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "", contingency: "descendants" }],
    organDonation: "silent",
    funeralPreference: "family_decides",
    ...o,
  };
}
const data = (o: Record<string, unknown> = {}) => mapIntakeToTemplateData(answers(o)).data!;

describe("funeral preference is now asked, not defaulted", () => {
  it.each([
    ["burial", "interred by burial"],
    ["cremation", "disposed of by cremation"],
    ["family_decides", "to my Personal Representative."],
  ])("%s renders its own clause", (choice, marker) => {
    const out = renderTemplate(WILL, data({ funeralPreference: choice }));
    const clause = out.slice(out.indexOf("— Funeral and Burial Preference."), out.indexOf("— Reference to Funeral Representative"));
    expect(clause).toContain(marker);
  });

  it("the family_decides clause no longer consults the family", () => {
    const out = renderTemplate(WILL, data({ funeralPreference: "family_decides" }));
    expect(out).toContain("to my Personal Representative.");
    expect(out).not.toContain("in consultation with my surviving family members");
  });

  it("has no default — an unanswered will is blocked", () => {
    expect(data({ funeralPreference: "" }).funeral_preference).toBe("");
    expect(validateForDocument("will", data({ funeralPreference: "" })))
      .toContain("your wishes for your remains");
  });

  it("passes once answered", () => {
    expect(validateForDocument("will", data())).toEqual([]);
  });

  it.each(["will", "trust"] as const)("%s flow routes an in-flight session back for it", (flow) => {
    const old = { ...answers(), funeralPreference: undefined,
      isJointTrust: "No",
      poaAgentName: "Raga Hassan", poaAgentRelationship: "Spouse/Partner",
      poaPowers: ["Banking and finances"], poaEffective: "immediate",
      patientAdvocateName: "Raga Hassan", patientAdvocateRelationship: "Spouse/Partner" };
    const resume = findResumePoint(flow, old as Record<string, unknown>);
    expect(resume).not.toBeNull();
    expect(resume!.step).toBe("gifts");
    expect(resume!.missingFields).toContain("funeralPreference");
  });

  it("lets a complete session through", () => {
    const complete = { ...answers(), isJointTrust: "No",
      poaAgentName: "Raga Hassan", poaAgentRelationship: "Spouse/Partner",
      poaPowers: ["Banking and finances"], poaEffective: "immediate",
      patientAdvocateName: "Raga Hassan", patientAdvocateRelationship: "Spouse/Partner" };
    expect(findResumePoint("will", complete as Record<string, unknown>)).toBeNull();
  });
});

describe("joint co-trustee authority", () => {
  const joint = (o: Record<string, unknown> = {}) =>
    data({ isJointTrust: "Yes", secondGrantorName: "Raga Hassan", ...o });

  it("a trust is joint only when the client says so AND names someone", () => {
    expect(data({ isJointTrust: "No", secondGrantorName: "Raga Hassan" }).is_joint_trust).toBe(false);
    expect(joint().is_joint_trust).toBe(true);
  });

  it("renders the act-alone branch when chosen", () => {
    const out = renderTemplate(TRUST, joint({ jointTrusteeAuthority: "either_alone" }));
    expect(out).toContain("Either Co-Trustee, acting alone, may transact business on behalf of the Trust.");
    expect(out).not.toContain("The Co-Trustees shall act jointly.");
  });

  it("renders the act-jointly branch when chosen", () => {
    const out = renderTemplate(TRUST, joint({ jointTrusteeAuthority: "jointly" }));
    expect(out).toContain("The Co-Trustees shall act jointly.");
    expect(out).toContain("requires the signature or written consent of both Co-Trustees");
    expect(out).not.toContain("Either Co-Trustee, acting alone");
  });

  it("blocks a joint trust that has not answered", () => {
    expect(validateForDocument("trust", joint({ jointTrusteeAuthority: "" })))
      .toContain("whether the Co-Trustees may act alone or must act jointly");
  });

  it("does not ask a single-grantor trust", () => {
    expect(validateForDocument("trust", data())).toEqual([]);
  });

  it("the question component is wired into the trust flow", () => {
    const page = readFileSync(join(__dirname, "..", "..", "app", "trust", "page.tsx"), "utf8");
    expect(page).toContain("<JointTrusteeAuthority");
    expect(page).toContain("jointTrusteeAuthority");
    // and the second grantor is actually collected, which is what makes it reachable
    expect(page).toContain("Are you creating this trust jointly");
    expect(page).toContain("intake.secondGrantorName");
  });
});

describe("trust flow collects everything the trust template requires", () => {
  const legacyTrust = {
    firstName: "Ahmed", lastName: "Hassan", city: "Dearborn Heights", state: "Michigan",
    successorTrusteeName: "Karim Hassan", successorTrusteeRelationship: "Sibling",
    executorName: "Raga Hassan", executorRelationship: "Spouse/Partner",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "" }],
    poaAgentName: "Raga Hassan", poaAgentRelationship: "Spouse/Partner",
    poaPowers: ["Banking and finances"], poaEffective: "immediate",
    patientAdvocateName: "Raga Hassan", patientAdvocateRelationship: "Spouse/Partner",
    organDonation: "silent",
  };

  it("asks the per-beneficiary contingency in the trust questionnaire, not only the will", () => {
    const page = readFileSync(join(__dirname, "..", "..", "app", "trust", "page.tsx"), "utf8");
    expect(page).toContain("<BeneficiaryContingency");
    expect(page).toContain("contingenciesComplete(intake.beneficiaries)");
  });

  it("blocks a trust whose beneficiary has no contingency answer", () => {
    const d = mapIntakeToTemplateData(legacyTrust).data!;
    expect(validateForDocument("trust", d).join(" ")).toContain("if they do not survive");
  });

  it("routes a legacy trust session back to a step that can actually answer it", () => {
    const resume = findResumePoint("trust", legacyTrust as Record<string, unknown>);
    expect(resume).not.toBeNull();
    // isJointTrust comes first, on the trustee step, which precedes beneficiaries
    expect(resume!.step).toBe("trustee");
    expect(resume!.missingFields).toEqual(
      expect.arrayContaining(["isJointTrust", "beneficiaries[].contingency", "funeralPreference"]),
    );
  });

  it("does not ask the co-trustee question of a session that is not joint", () => {
    const single = { ...legacyTrust, isJointTrust: "No" };
    expect(findResumePoint("trust", single as Record<string, unknown>)!.missingFields)
      .not.toContain("jointTrusteeAuthority");
  });

  it("asks it of a joint session that never answered it", () => {
    const joint = { ...legacyTrust, isJointTrust: "Yes", secondGrantorName: "Raga Hassan" };
    const resume = findResumePoint("trust", joint as Record<string, unknown>)!;
    expect(resume.step).toBe("trustee");
    expect(resume.missingFields).toContain("jointTrusteeAuthority");
  });
});

describe("free text the templates wrap in their own sentence", () => {
  it("does not produce a double period when the client ends with one", () => {
    const d = mapIntakeToTemplateData({
      ...answers(), organDonation: "specific_purposes",
      organDonationPurposes: "Transplantation and therapy only.",
    }).data!;
    expect(d.organ_donation_purposes_text).toBe("Transplantation and therapy only");
    const out = renderTemplate(WILL, d);
    expect(out).toContain("therapy only. No gift shall be made");
    expect(out).not.toContain("..");
  });

  it("leaves text that has no trailing period alone", () => {
    const d = mapIntakeToTemplateData({
      ...answers(), organDonation: "specific_purposes",
      organDonationPurposes: "transplantation and therapy only",
    }).data!;
    expect(d.organ_donation_purposes_text).toBe("transplantation and therapy only");
  });
});
