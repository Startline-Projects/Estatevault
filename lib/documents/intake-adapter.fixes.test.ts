/**
 * Regression tests for the intake-adapter field-mapping fixes.
 *
 * Each block below corresponds to a field the questionnaire collected and the
 * adapter previously dropped, causing the template pipeline to render a blank
 * clause or — in the DPOA case — grant authority the client never selected.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { mapIntakeToTemplateData, validateForDocument, type TemplateWillIntake } from "./intake-adapter";
import { renderTemplate } from "./render-template";

function loadTemplate(name: string): string {
  return readFileSync(join(__dirname, "templates", `${name}.txt`), "utf8");
}

/** A complete trust-questionnaire answer set, as the quiz actually stores it. */
function trustQuizAnswers(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    firstName: "Ahmed",
    lastName: "Hassan",
    dateOfBirth: "1975-01-15",
    city: "Dearborn",
    state: "Michigan",
    maritalStatus: "Married",
    trustName: "",
    primaryTrustee: "Myself",
    trusteeName: "Ahmed Hassan",
    successorTrusteeName: "Raga Hassan",
    successorTrusteeRelationship: "Spouse",
    additionalSuccessorTrustees: [{ name: "Karim Hassan", relationship: "Sibling" }],
    beneficiaries: [
      { name: "Layla Hassan", relationship: "Child", share: "", contingency: "other_beneficiaries" },
      { name: "Omar Hassan", relationship: "Child", share: "", contingency: "other_beneficiaries" },
    ],
    beneficiariesEqualShares: "Yes",
    distributionAge: "25",
    hasMinorChildren: "Yes",
    guardianName: "Karim Hassan",
    guardianRelationship: "Sibling",
    successorGuardianName: "Nadia Hassan",
    assetTypes: ["Bank and investment accounts"],
    executorName: "Raga Hassan",
    executorRelationship: "Spouse",
    successorExecutorName: "Karim Hassan",
    successorExecutorRelationship: "Sibling",
    poaAgentName: "Raga Hassan",
    poaAgentRelationship: "Spouse",
    poaSuccessorAgentName: "Karim Hassan",
    poaSuccessorAgentRelationship: "Sibling",
    poaPowers: ["Banking and finances"],
    patientAdvocateName: "Raga Hassan",
    patientAdvocateRelationship: "Spouse",
    successorPatientAdvocateName: "Karim Hassan",
    organDonation: "Yes",
    hasHealthcareWishes: "Yes",
    healthcareWishesDescription: "I do not wish to be kept on life support without a reasonable chance of recovery.",
    hasContingentBeneficiary: "No",
    contingentBeneficiaries: [],
    contingentEqualShares: "",
    hasSpecificGifts: "Yes",
    specificGiftsDescription: "My grandfather's pocket watch to my son Omar.",
    ...overrides,
  };
}

function adapt(raw: Record<string, unknown>): TemplateWillIntake {
  const r = mapIntakeToTemplateData(raw);
  expect(r.error).toBeNull();
  return r.data!;
}

describe("DPOA powers — granted only when selected", () => {
  it("maps a banking-only selection to exactly one power", () => {
    const d = adapt(trustQuizAnswers({ poaPowers: ["Banking and finances"] }));
    expect(d.dpoa_powers).toEqual(["banking"]);
  });

  it("renders a banking-only DPOA: no real estate, business, tax, or digital authority", () => {
    const d = adapt(trustQuizAnswers({ poaPowers: ["Banking and finances"] }));
    const out = renderTemplate(loadTemplate("dpoa-michigan-v1.1.0"), d);

    expect(out).toContain("Banking and Financial Institution Transactions.  GRANTED.");

    // The powers the client did not select must not appear anywhere.
    expect(out).not.toContain("Real Estate Transactions.  GRANTED.");
    expect(out).not.toContain("Business Interests.  GRANTED.");
    expect(out).not.toContain("Digital Assets.  GRANTED.");
    // Since Prompt 2 a declined power is stated as NOT GRANTED rather than
    // omitted, so the real-estate wording appears — in the negative.
    expect(out).toContain("NOT authorized to buy, sell, lease, mortgage, encumber");
    expect(out).not.toMatch(/The Agent is authorized to buy, sell, lease, mortgage, encumber/);

    // Gift-making and estate-plan amendment were removed as options (Prompt 9).
    expect(out).not.toContain("Gift-Making Authority");
    expect(out).not.toContain("Authority to Make Changes to Estate Plan");
  });

  it("maps each questionnaire label to its template token", () => {
    const d = adapt(trustQuizAnswers({
      poaPowers: ["Banking and finances", "Real estate transactions", "Business operations", "Tax filings"],
    }));
    expect(d.dpoa_powers.sort()).toEqual(["banking", "business", "real_estate", "tax"]);
  });

  it("always includes banking, which the questionnaire does not allow deselecting", () => {
    const d = adapt(trustQuizAnswers({ poaPowers: ["Tax filings"] }));
    expect(d.dpoa_powers).toContain("banking");
    expect(d.dpoa_powers).toContain("tax");
  });

  it("accepts pre-tokenized input and the legacy powers object without double-granting", () => {
    expect(adapt(trustQuizAnswers({ poaPowers: ["banking", "real_estate"] })).dpoa_powers.sort())
      .toEqual(["banking", "real_estate"]);
    expect(adapt(trustQuizAnswers({ poaPowers: undefined, powers: { real_estate: true, business: false } })).dpoa_powers.sort())
      .toEqual(["banking", "real_estate"]);
  });

  it("grants nothing when the client selected nothing", () => {
    const d = adapt({ firstName: "Bob", lastName: "Test" });
    expect(d.dpoa_powers).toEqual([]);
  });
});

describe("previously dropped fields are now mapped", () => {
  const d = adapt(trustQuizAnswers());

  it("carries the successor DPOA agent", () => {
    expect(d.first_successor_dpoa_agent.full_name).toBe("Karim Hassan");
    expect(d.first_successor_dpoa_agent.relationship).toBe("Sibling");
  });

  it("carries the successor patient advocate", () => {
    expect(d.successor_patient_advocate.full_name).toBe("Karim Hassan");
  });

  it("carries specific gifts as the client's own words", () => {
    expect(d.has_specific_gifts).toBe(true);
    expect(d.specific_gifts_freeform).toContain("pocket watch");
  });

  it("carries free-text healthcare wishes", () => {
    expect(d.healthcare_wishes_freeform).toContain("life support");
  });

  it("normalizes organ donation to a token the template branches on", () => {
    expect(d.organ_donation).toBe("any_purpose");
    expect(adapt(trustQuizAnswers({ organDonation: "No" })).organ_donation).toBe("none");
  });

  it("derives the county from the city when the questionnaire did not ask", () => {
    expect(d.county).toBe("Wayne");
  });

  it("keeps an explicit county over the derived one", () => {
    expect(adapt(trustQuizAnswers({ county: "Oakland" })).county).toBe("Oakland");
  });

  it("clears contingent beneficiaries when the client answered No", () => {
    expect(d.contingent_beneficiaries).toEqual([]);
  });

  it("maps a children roster when one is supplied", () => {
    const withKids = adapt(trustQuizAnswers({
      children: [{ name: "Layla Hassan", dateOfBirth: "2012-04-02", isMinor: true }],
    }));
    expect(withKids.children).toHaveLength(1);
    expect(withKids.children[0].full_name).toBe("Layla Hassan");
    expect(withKids.has_children).toBe(true);
  });
});

describe("pre-array beneficiary intakes still produce a residuary", () => {
  it("maps a single legacy beneficiary to 100%", () => {
    const d = adapt({
      firstName: "Ann", lastName: "Lee",
      primaryBeneficiaryName: "Bo Lee", primaryBeneficiaryRelationship: "Spouse",
    });
    expect(d.primary_beneficiaries).toEqual([
      {
        full_name: "Bo Lee", relationship: "Spouse", share_percent: "100",
        per_stirpes: false,
        // A pre-array session predates the contingency question, so it is left
        // unanswered and strict validation asks for it.
        contingency: "", contingent_full_name: "",
      },
    ]);
  });

  it("maps a legacy 50/50 split", () => {
    const d = adapt({
      firstName: "Ann", lastName: "Lee",
      primaryBeneficiaryName: "Bo Lee", secondBeneficiaryName: "Cy Lee", estateSplit: "50/50",
    });
    expect(d.primary_beneficiaries.map((b) => b.share_percent)).toEqual(["50", "50"]);
  });

  it("maps a legacy custom split", () => {
    const d = adapt({
      firstName: "Ann", lastName: "Lee",
      primaryBeneficiaryName: "Bo Lee", secondBeneficiaryName: "Cy Lee",
      estateSplit: "Custom", customSplit: "70/30",
    });
    expect(d.primary_beneficiaries.map((b) => b.share_percent)).toEqual(["70", "30"]);
  });

  it("prefers the array shape when both are present", () => {
    const d = adapt({
      firstName: "Ann", lastName: "Lee",
      primaryBeneficiaryName: "Legacy Person",
      beneficiaries: [{ name: "Array Person", relationship: "Child", share: "100", contingency: "other_beneficiaries" }],
      beneficiariesEqualShares: "No",
    });
    expect(d.primary_beneficiaries).toHaveLength(1);
    expect(d.primary_beneficiaries[0].full_name).toBe("Array Person");
  });
});

describe("strict per-document validation", () => {
  it("passes a complete will intake", () => {
    expect(validateForDocument("will", adapt(trustQuizAnswers()))).toEqual([]);
  });

  it("fails a will with no beneficiaries", () => {
    const d = adapt(trustQuizAnswers({ beneficiaries: [] }));
    expect(validateForDocument("will", d)).toContain("at least one primary beneficiary");
  });

  it("fails a will whose personal representative is missing", () => {
    const d = adapt(trustQuizAnswers({ executorName: "", executorRelationship: "" }));
    expect(validateForDocument("will", d)).toContain("personal representative");
  });

  it("fails a DPOA with no powers granted", () => {
    const d = adapt(trustQuizAnswers({ poaPowers: [] }));
    expect(validateForDocument("dpoa", d)).toContain("at least one power granted to the agent");
  });

  it("fails a DPOA with no agent", () => {
    const d = adapt(trustQuizAnswers({ poaAgentName: "", poaAgentRelationship: "" }));
    expect(validateForDocument("dpoa", d)).toContain("power of attorney agent");
  });

  it("passes the Advance Healthcare Directive once the advocate and donation answer exist", () => {
    // The two treatment-preference questions were removed on attorney
    // instruction; the directive's language is fixed text.
    expect(validateForDocument("ahcd", adapt(trustQuizAnswers()))).toEqual([]);
  });

  it("blocks the directive when organ donation is unanswered", () => {
    const d = adapt(trustQuizAnswers({ organDonation: "" }));
    expect(validateForDocument("ahcd", d)).toContain("organ donation preference");
  });

  it("fails when gifts were requested but nothing was captured", () => {
    const d = adapt(trustQuizAnswers({ hasSpecificGifts: "Yes", specificGiftsDescription: "" }));
    expect(validateForDocument("will", d)).toContain(
      "specific gifts were requested but no gift details were captured",
    );
  });
});

describe("a sole beneficiary means 100%, not an unanswered share", () => {
  // The questionnaire only asks about shares when there is more than one
  // beneficiary, so a single-beneficiary intake arrives with share "" and no
  // equal-shares answer. Found by driving the browser: every such will was
  // blocked for a share the client was never asked for.
  const soleBeneficiary = {
    firstName: "Ahmed", lastName: "Hassan",
    executorName: "Raga Hassan", executorRelationship: "Spouse/Partner",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "", contingency: "other_beneficiaries" }],
    beneficiariesEqualShares: "",
  };

  it("assigns 100% to a lone beneficiary", () => {
    const d = adapt(soleBeneficiary);
    expect(d.primary_beneficiaries).toHaveLength(1);
    expect(d.primary_beneficiaries[0].share_percent).toBe("100");
  });

  it("lets that will through strict validation", () => {
    expect(validateForDocument("will", adapt(soleBeneficiary))).toEqual([]);
  });

  it("leaves multi-beneficiary shares alone", () => {
    const d = adapt({
      ...soleBeneficiary,
      beneficiaries: [
        { name: "A", relationship: "Child", share: "", contingency: "other_beneficiaries" },
        { name: "B", relationship: "Child", share: "", contingency: "other_beneficiaries" },
      ],
      beneficiariesEqualShares: "",
    });
    // Two beneficiaries with no equal-shares answer is genuinely unanswered.
    expect(d.primary_beneficiaries.map((b) => b.share_percent)).toEqual(["", ""]);
    expect(validateForDocument("will", d)).toContain("primary beneficiary 1 share");
  });

  it("still honours an explicit share on a lone beneficiary", () => {
    const d = adapt({
      ...soleBeneficiary,
      beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "100", contingency: "other_beneficiaries" }],
    });
    expect(d.primary_beneficiaries[0].share_percent).toBe("100");
  });
});
