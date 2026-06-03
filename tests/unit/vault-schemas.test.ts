import { describe, it, expect } from "vitest";
import {
  vaultItemSchema,
  trusteeCreateSchema,
  farewellCreateSchema,
  farewellUpdateSchema,
} from "@/lib/validation/schemas";

describe("trusteeCreateSchema", () => {
  it("accepts a valid trustee", () => {
    const r = trusteeCreateSchema.safeParse({ name: "Jo", email: "jo@example.com", relationship: "sister" });
    expect(r.success).toBe(true);
  });

  it("rejects a malformed email (the gap Phase 3 closes)", () => {
    const r = trusteeCreateSchema.safeParse({ name: "Jo", email: "banana" });
    expect(r.success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(trusteeCreateSchema.safeParse({ name: "", email: "jo@example.com" }).success).toBe(false);
  });

  it("allows an empty/omitted relationship", () => {
    expect(trusteeCreateSchema.safeParse({ name: "Jo", email: "jo@example.com", relationship: "" }).success).toBe(true);
  });
});

describe("farewellCreateSchema", () => {
  it("accepts a valid message", () => {
    expect(farewellCreateSchema.safeParse({ title: "For Mom", recipientEmail: "mom@example.com" }).success).toBe(true);
  });

  it("rejects a bad recipient email", () => {
    expect(farewellCreateSchema.safeParse({ title: "For Mom", recipientEmail: "nope" }).success).toBe(false);
  });

  it("requires a title", () => {
    expect(farewellCreateSchema.safeParse({ title: "", recipientEmail: "mom@example.com" }).success).toBe(false);
  });

  it("allows null storagePath / sizes (metadata-only locked record)", () => {
    const r = farewellCreateSchema.safeParse({
      title: "For Mom", recipientEmail: "mom@example.com",
      storagePath: null, fileSizeMb: null, durationSeconds: null,
    });
    expect(r.success).toBe(true);
  });
});

describe("farewellUpdateSchema", () => {
  it("requires messageId", () => {
    expect(farewellUpdateSchema.safeParse({ title: "x" }).success).toBe(false);
  });

  it("validates a supplied recipient email but allows omitting it", () => {
    expect(farewellUpdateSchema.safeParse({ messageId: "abc" }).success).toBe(true);
    expect(farewellUpdateSchema.safeParse({ messageId: "abc", recipientEmail: "bad" }).success).toBe(false);
  });
});

describe("vaultItemSchema", () => {
  it("accepts a known category and defaults data to {}", () => {
    const r = vaultItemSchema.safeParse({ category: "insurance", label: "Policy" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.data).toEqual({});
  });

  it("rejects an unknown category", () => {
    expect(vaultItemSchema.safeParse({ category: "spaceship", label: "x" }).success).toBe(false);
  });

  it("rejects a pure-number company name (server-side enforcement)", () => {
    const r = vaultItemSchema.safeParse({ category: "insurance", label: "Policy", data: { company: "12345" } });
    expect(r.success).toBe(false);
  });

  it("accepts a well-formed insurance payload", () => {
    const r = vaultItemSchema.safeParse({
      category: "insurance",
      label: "Policy",
      data: { company: "State Farm", coverage_amount: "$100,000", policy_number: "POL-1" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects a bad phone in a contact", () => {
    const r = vaultItemSchema.safeParse({ category: "contact", label: "Lawyer", data: { phone: "abc" } });
    expect(r.success).toBe(false);
  });
});
