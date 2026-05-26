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

describe("willCheckoutSchema", () => {
  it("requires intakeAnswers and rejects a bad customer email", () => {
    expect(willCheckoutSchema.safeParse({}).success).toBe(false);
    expect(willCheckoutSchema.safeParse({ intakeAnswers: { name: "x" }, customerEmail: "banana" }).success).toBe(false);
  });
  it("accepts the minimal valid body", () => {
    expect(willCheckoutSchema.safeParse({ intakeAnswers: {} }).success).toBe(true);
  });
});

describe("trustCheckoutSchema", () => {
  it("accepts the trust-specific extra fields", () => {
    const r = trustCheckoutSchema.safeParse({
      intakeAnswers: { trust_type: "revocable" },
      complexityFlag: true,
      complexityReasons: ["X"],
      declinedAttorneyReview: true,
      confirmOverride: true,
    });
    expect(r.success).toBe(true);
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
