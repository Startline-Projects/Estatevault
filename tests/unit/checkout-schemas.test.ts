import { describe, it, expect } from "vitest";
import {
  willCheckoutSchema,
  trustCheckoutSchema,
  amendmentCheckoutSchema,
  vaultSubscriptionCheckoutSchema,
  partnerCheckoutSchema,
  attorneyCheckoutSchema,
  attorneyVerifySchema,
  checkoutVerifyQuerySchema,
  checkConflictSchema,
} from "@/lib/validation/schemas";

const VALID_WILL_INTAKE = {
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: "1990-01-15",
  city: "Detroit",
  state: "Michigan",
  maritalStatus: "Married" as const,
  hasMinorChildren: "No" as const,
  executorName: "Jane Doe",
  executorRelationship: "Spouse/Partner" as const,
  successorExecutorName: "",
  successorExecutorRelationship: "",
  beneficiaries: [{ name: "Jane Doe", relationship: "Spouse/Partner" as const, share: "100" }],
  beneficiariesEqualShares: "Yes" as const,
  guardianName: "",
  guardianRelationship: "",
  successorGuardianName: "",
  hasContingentBeneficiary: "No" as const,
  contingentBeneficiaries: [],
  contingentEqualShares: "",
  organDonation: "Yes" as const,
  hasSpecificGifts: "No" as const,
  specificGiftsDescription: "",
};

const VALID_TRUST_INTAKE = {
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: "1990-01-15",
  city: "Detroit",
  state: "Michigan",
  maritalStatus: "Married" as const,
  trustName: "The John Doe Revocable Living Trust",
  primaryTrustee: "Myself" as const,
  trusteeName: "",
  successorTrusteeName: "Jane Doe",
  successorTrusteeRelationship: "Spouse/Partner" as const,
  additionalSuccessorTrustees: [],
  beneficiaries: [{ name: "Jane Doe", relationship: "Spouse/Partner" as const, share: "100" }],
  beneficiariesEqualShares: "Yes" as const,
  distributionAge: "",
  hasMinorChildren: "No" as const,
  guardianName: "",
  guardianRelationship: "",
  successorGuardianName: "",
  assetTypes: ["Primary home / real estate in Michigan" as const],
  executorName: "Jane Doe",
  executorRelationship: "Spouse/Partner" as const,
  successorExecutorName: "",
  successorExecutorRelationship: "",
  poaAgentName: "Jane Doe",
  poaAgentRelationship: "Spouse/Partner" as const,
  poaSuccessorAgentName: "",
  poaSuccessorAgentRelationship: "",
  poaPowers: ["Banking and finances" as const],
  patientAdvocateName: "Jane Doe",
  patientAdvocateRelationship: "Spouse/Partner" as const,
  successorPatientAdvocateName: "",
  organDonation: "Yes" as const,
  hasHealthcareWishes: "No" as const,
  healthcareWishesDescription: "",
  hasContingentBeneficiary: "No" as const,
  contingentBeneficiaries: [],
  contingentEqualShares: "",
  hasSpecificGifts: "No" as const,
  specificGiftsDescription: "",
};

describe("willCheckoutSchema", () => {
  it("requires intakeAnswers and rejects a bad customer email", () => {
    expect(willCheckoutSchema.safeParse({}).success).toBe(false);
    expect(willCheckoutSchema.safeParse({ intakeAnswers: VALID_WILL_INTAKE, customerEmail: "banana" }).success).toBe(false);
  });
  it("accepts a valid will intake body", () => {
    expect(willCheckoutSchema.safeParse({ intakeAnswers: VALID_WILL_INTAKE }).success).toBe(true);
  });
  it("rejects invalid enum values in intake", () => {
    expect(willCheckoutSchema.safeParse({ intakeAnswers: { ...VALID_WILL_INTAKE, maritalStatus: "INVALID" } }).success).toBe(false);
    expect(willCheckoutSchema.safeParse({ intakeAnswers: { ...VALID_WILL_INTAKE, organDonation: "Maybe" } }).success).toBe(false);
  });
  it("rejects empty required fields", () => {
    expect(willCheckoutSchema.safeParse({ intakeAnswers: { ...VALID_WILL_INTAKE, firstName: "" } }).success).toBe(false);
    expect(willCheckoutSchema.safeParse({ intakeAnswers: { ...VALID_WILL_INTAKE, executorName: "" } }).success).toBe(false);
  });
  it("rejects missing beneficiaries", () => {
    expect(willCheckoutSchema.safeParse({ intakeAnswers: { ...VALID_WILL_INTAKE, beneficiaries: [] } }).success).toBe(false);
  });
});

describe("trustCheckoutSchema", () => {
  it("accepts the trust-specific extra fields", () => {
    const r = trustCheckoutSchema.safeParse({
      intakeAnswers: VALID_TRUST_INTAKE,
      complexityFlag: true,
      complexityReasons: ["X"],
      declinedAttorneyReview: true,
      confirmOverride: true,
    });
    expect(r.success).toBe(true);
  });
  it("rejects invalid asset types", () => {
    expect(trustCheckoutSchema.safeParse({
      intakeAnswers: { ...VALID_TRUST_INTAKE, assetTypes: ["Imaginary Assets"] },
    }).success).toBe(false);
  });
  it("rejects invalid POA powers", () => {
    expect(trustCheckoutSchema.safeParse({
      intakeAnswers: { ...VALID_TRUST_INTAKE, poaPowers: ["Hacking"] },
    }).success).toBe(false);
  });
});

describe("amendmentCheckoutSchema", () => {
  it("requires userId + changeType + description", () => {
    expect(amendmentCheckoutSchema.safeParse({ userId: "abc", changeType: "x", description: "y" }).success).toBe(true);
    expect(amendmentCheckoutSchema.safeParse({ userId: "", changeType: "x", description: "y" }).success).toBe(false);
    expect(amendmentCheckoutSchema.safeParse({ userId: "abc", changeType: "", description: "y" }).success).toBe(false);
  });
});

describe("partnerCheckoutSchema", () => {
  it("only accepts the 3 known tiers", () => {
    expect(partnerCheckoutSchema.safeParse({ partnerId: "id", tier: "basic" }).success).toBe(true);
    expect(partnerCheckoutSchema.safeParse({ partnerId: "id", tier: "standard" }).success).toBe(true);
    expect(partnerCheckoutSchema.safeParse({ partnerId: "id", tier: "enterprise" }).success).toBe(true);
    expect(partnerCheckoutSchema.safeParse({ partnerId: "id", tier: "premium" }).success).toBe(false);
    expect(partnerCheckoutSchema.safeParse({ tier: "basic" }).success).toBe(false);
  });
});

describe("attorneyCheckoutSchema", () => {
  it("requires bar_number, name, email format, tier", () => {
    const ok = {
      tier: "standard", email: "j@example.com", name: "Jane Doe", bar_number: "P123",
    };
    expect(attorneyCheckoutSchema.safeParse(ok).success).toBe(true);
    expect(attorneyCheckoutSchema.safeParse({ ...ok, email: "banana" }).success).toBe(false);
    expect(attorneyCheckoutSchema.safeParse({ ...ok, bar_number: "" }).success).toBe(false);
  });
});

describe("attorneyVerifySchema", () => {
  it("requires session_id", () => {
    expect(attorneyVerifySchema.safeParse({ session_id: "cs_1" }).success).toBe(true);
    expect(attorneyVerifySchema.safeParse({}).success).toBe(false);
  });
});

describe("checkoutVerifyQuerySchema", () => {
  it("requires session_id", () => {
    expect(checkoutVerifyQuerySchema.safeParse({ session_id: "cs_1" }).success).toBe(true);
    expect(checkoutVerifyQuerySchema.safeParse({ session_id: null }).success).toBe(false);
  });
});

describe("vaultSubscriptionCheckoutSchema", () => {
  it("validates an optional email and accepts an empty body", () => {
    expect(vaultSubscriptionCheckoutSchema.safeParse({}).success).toBe(true);
    expect(vaultSubscriptionCheckoutSchema.safeParse({ email: "x@example.com" }).success).toBe(true);
    expect(vaultSubscriptionCheckoutSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("checkConflictSchema", () => {
  it("rejects malformed emails and bad product types", () => {
    expect(checkConflictSchema.safeParse({ email: "x@y.com", productType: "will" }).success).toBe(true);
    expect(checkConflictSchema.safeParse({ email: "x@y.com", productType: "amendment" }).success).toBe(false);
    expect(checkConflictSchema.safeParse({ email: "nope", productType: "will" }).success).toBe(false);
  });
});
