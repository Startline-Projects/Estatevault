import { describe, it, expect } from "vitest";
import { validateField, validateCategoryData } from "@/lib/validation/vaultFieldRules";

describe("validateField", () => {
  it("name: rejects pure numbers, accepts real names", () => {
    expect(validateField("name", "12345")).not.toBeNull();      // user's complaint
    expect(validateField("name", "!!")).not.toBeNull();
    expect(validateField("name", "State Farm")).toBeNull();
    expect(validateField("name", "O'Brien")).toBeNull();
  });

  it("phone: accepts formatted/intl, rejects junk", () => {
    expect(validateField("phone", "(555) 123-4567")).toBeNull();
    expect(validateField("phone", "+44 20 7946 0958")).toBeNull();
    expect(validateField("phone", "abc")).not.toBeNull();
    expect(validateField("phone", "123")).not.toBeNull();       // too few digits
  });

  it("email: standard regex", () => {
    expect(validateField("email", "a@b.com")).toBeNull();
    expect(validateField("email", "banana")).not.toBeNull();
  });

  it("digits4: exactly four digits", () => {
    expect(validateField("digits4", "1234")).toBeNull();
    expect(validateField("digits4", "12")).not.toBeNull();
    expect(validateField("digits4", "12ab")).not.toBeNull();
  });

  it("percent: 0..100", () => {
    expect(validateField("percent", "50")).toBeNull();
    expect(validateField("percent", "0")).toBeNull();
    expect(validateField("percent", "101")).not.toBeNull();
    expect(validateField("percent", "abc")).not.toBeNull();
  });

  it("currency: positive amount", () => {
    expect(validateField("currency", "$1,000.00")).toBeNull();
    expect(validateField("currency", "500")).toBeNull();
    expect(validateField("currency", "abc")).not.toBeNull();
    expect(validateField("currency", "0")).not.toBeNull();
  });

  it("alphanumeric: letters/numbers/space/dash only", () => {
    expect(validateField("alphanumeric", "POL-123")).toBeNull();
    expect(validateField("alphanumeric", "abc@#$")).not.toBeNull();
  });

  it("empty optional → ok, empty required → error", () => {
    expect(validateField("name", "")).toBeNull();
    expect(validateField("name", "", true)).not.toBeNull();
    expect(validateField(undefined, "anything")).toBeNull();
  });
});

describe("validateCategoryData", () => {
  it("flags a pure-number company name in insurance", () => {
    const errs = validateCategoryData("insurance", { label: "My policy", company: "12345" });
    expect(errs.company).toBeDefined();
  });

  it("passes a clean insurance blob", () => {
    const errs = validateCategoryData("insurance", {
      label: "My policy", company: "State Farm", policy_number: "POL-99", coverage_amount: "$100,000", beneficiary: "Jane Doe",
    });
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("validates business label as a name (rejects digits-only)", () => {
    const errs = validateCategoryData("business", { label: "999" });
    expect(errs.label).toBeDefined();
  });
});
