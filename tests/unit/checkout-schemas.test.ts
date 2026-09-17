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

import { VALID_WILL_INTAKE, VALID_TRUST_INTAKE } from "../fixtures/intake";

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
  it("accepts a single beneficiary with blank share and blank equal-shares flag (implicit 100%)", () => {
    // The intake UI only renders the equal-shares question + share inputs when
    // beneficiaries.length > 1, so a sole beneficiary arrives with share "" and
    // beneficiariesEqualShares "". That must validate — the one beneficiary gets 100%.
    expect(willCheckoutSchema.safeParse({ intakeAnswers: {
      ...VALID_WILL_INTAKE,
      beneficiaries: [{ name: "Jane Doe", relationship: "Spouse/Partner" as const, share: "", contingency: "other_beneficiaries" as const }],
      beneficiariesEqualShares: "",
    } }).success).toBe(true);
  });
  it("still rejects >1 beneficiaries whose shares don't total 100%", () => {
    expect(willCheckoutSchema.safeParse({ intakeAnswers: {
      ...VALID_WILL_INTAKE,
      beneficiaries: [
        { name: "A", relationship: "Child" as const, share: "60", contingency: "other_beneficiaries" as const },
        { name: "B", relationship: "Child" as const, share: "30", contingency: "other_beneficiaries" as const },
      ],
      beneficiariesEqualShares: "No",
    } }).success).toBe(false);
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
  it("accepts a single beneficiary with blank share and blank equal-shares flag (implicit 100%)", () => {
    expect(trustCheckoutSchema.safeParse({ intakeAnswers: {
      ...VALID_TRUST_INTAKE,
      beneficiaries: [{ name: "Jane Doe", relationship: "Spouse/Partner" as const, share: "", contingency: "other_beneficiaries" as const }],
      beneficiariesEqualShares: "",
    } }).success).toBe(true);
  });
});

describe("amendmentCheckoutSchema", () => {
  it("requires userId + changeType + description + the signed acknowledgment", () => {
    const valid = { userId: "abc", changeType: "x", description: "y", acknowledgmentSigned: true as const };
    expect(amendmentCheckoutSchema.safeParse(valid).success).toBe(true);
    expect(amendmentCheckoutSchema.safeParse({ ...valid, userId: "" }).success).toBe(false);
    expect(amendmentCheckoutSchema.safeParse({ ...valid, changeType: "" }).success).toBe(false);
  });
});

describe("Core Rule 3 — the acknowledgment cannot be skipped", () => {
  it("rejects an amendment with no acknowledgment, or a falsified one", () => {
    const base = { userId: "abc", changeType: "x", description: "y" };
    expect(amendmentCheckoutSchema.safeParse(base).success).toBe(false);
    expect(amendmentCheckoutSchema.safeParse({ ...base, acknowledgmentSigned: false }).success).toBe(false);
    expect(amendmentCheckoutSchema.safeParse({ ...base, acknowledgmentSigned: "yes" }).success).toBe(false);
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

describe("Core Rule 4 — every trigger the questionnaire asks must survive the schema", () => {
  // z.object() strips keys it does not declare. The special-needs question was
  // asked on both questionnaires, carried by both intake types, and dropped
  // here, so the checkout gate never saw a "Yes". Each trigger now has to be
  // answered — an unanswered one is a 400, never a silent "No".
  const TRIGGERS = ["hasSpecialNeedsDependent", "wantsIrrevocableTrust", "hasMedicaidPlanning", "hasEstateDispute"] as const;

  it.each(TRIGGERS)("will: %s is required and kept", (field) => {
    const { [field]: _omit, ...without } = VALID_WILL_INTAKE;
    expect(willCheckoutSchema.safeParse({ intakeAnswers: without }).success).toBe(false);
    const parsed = willCheckoutSchema.parse({ intakeAnswers: { ...VALID_WILL_INTAKE, [field]: "Yes" } });
    expect(parsed.intakeAnswers[field]).toBe("Yes");
  });

  it.each(TRIGGERS)("trust: %s is required and kept", (field) => {
    const { [field]: _omit, ...without } = VALID_TRUST_INTAKE;
    expect(trustCheckoutSchema.safeParse({ intakeAnswers: without }).success).toBe(false);
    const parsed = trustCheckoutSchema.parse({ intakeAnswers: { ...VALID_TRUST_INTAKE, [field]: "Yes" } });
    expect(parsed.intakeAnswers[field]).toBe("Yes");
  });

  it("only Yes/No are answers", () => {
    expect(willCheckoutSchema.safeParse({ intakeAnswers: { ...VALID_WILL_INTAKE, hasSpecialNeedsDependent: "" } }).success).toBe(false);
    expect(willCheckoutSchema.safeParse({ intakeAnswers: { ...VALID_WILL_INTAKE, hasSpecialNeedsDependent: "maybe" } }).success).toBe(false);
  });
});

describe("mailbox proof reaches the checkout", () => {
  // verifiedToken had no declaration on either checkout schema, so Zod removed
  // it and the free-promo path could never see a verified returning client.
  it("both checkout schemas keep verifiedToken", () => {
    expect(willCheckoutSchema.parse({ intakeAnswers: VALID_WILL_INTAKE, verifiedToken: "t-1" }).verifiedToken).toBe("t-1");
    expect(trustCheckoutSchema.parse({ intakeAnswers: VALID_TRUST_INTAKE, verifiedToken: "t-1" }).verifiedToken).toBe("t-1");
  });
  it("it is optional, and an empty token is not a token", () => {
    expect(willCheckoutSchema.parse({ intakeAnswers: VALID_WILL_INTAKE }).verifiedToken).toBeUndefined();
    expect(willCheckoutSchema.safeParse({ intakeAnswers: VALID_WILL_INTAKE, verifiedToken: "" }).success).toBe(false);
  });
  it("undeclared keys are still stripped — this is the behaviour that bit us", () => {
    const parsed = willCheckoutSchema.parse({ intakeAnswers: VALID_WILL_INTAKE, userId: "attacker-chosen" } as never);
    expect("userId" in parsed).toBe(false);
  });
});
