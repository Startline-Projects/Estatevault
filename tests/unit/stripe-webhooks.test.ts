import { describe, it, expect } from "vitest";
import { calculateSplit } from "@/lib/stripe-payouts";

describe("stripe revenue splits", () => {
  it("standard will: partner gets $300, platform gets $100", () => {
    const r = calculateSplit("will", "standard");
    expect(r.partnerCut).toBe(30000); // cents
    expect(r.evCut).toBe(10000);
    expect(r.partnerCut + r.evCut).toBe(40000); // $400 total
  });

  it("standard trust: partner gets $400, platform gets $200", () => {
    const r = calculateSplit("trust", "standard");
    expect(r.partnerCut).toBe(40000);
    expect(r.evCut).toBe(20000);
    expect(r.partnerCut + r.evCut).toBe(60000); // $600 total
  });

  it("enterprise will: partner gets $350, platform gets $50", () => {
    const r = calculateSplit("will", "enterprise");
    expect(r.partnerCut).toBe(35000);
    expect(r.evCut).toBe(5000);
    expect(r.partnerCut + r.evCut).toBe(40000);
  });

  it("enterprise trust: partner gets $450, platform gets $150", () => {
    const r = calculateSplit("trust", "enterprise");
    expect(r.partnerCut).toBe(45000);
    expect(r.evCut).toBe(15000);
    expect(r.partnerCut + r.evCut).toBe(60000);
  });

  it("attorney_review: platform takes nothing (goes to attorney)", () => {
    const r = calculateSplit("attorney_review", "standard");
    expect(r.evCut).toBe(0);
    expect(r.partnerCut).toBe(0);
  });

  it("amendment: standard split adds up", () => {
    const r = calculateSplit("amendment", "standard");
    expect(r.partnerCut + r.evCut).toBe(5000); // $50
  });

  it("affiliate will: affiliate gets $100, platform keeps $300", () => {
    const r = calculateSplit("will", "standard", { affiliate: true });
    expect(r.affiliateCut).toBe(10000);
    expect(r.evCut).toBe(30000);
    expect(r.partnerCut).toBe(0);
  });

  it("all splits produce non-negative values", () => {
    const types = ["will", "trust", "amendment", "attorney_review"];
    const tiers = ["standard", "enterprise"] as const;
    for (const type of types) {
      for (const tier of tiers) {
        const r = calculateSplit(type, tier);
        expect(r.evCut).toBeGreaterThanOrEqual(0);
        expect(r.partnerCut).toBeGreaterThanOrEqual(0);
        expect(r.affiliateCut).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("unknown product type returns zero split", () => {
    const r = calculateSplit("unknown_product", "standard");
    expect(r.evCut).toBe(0);
    expect(r.partnerCut).toBe(0);
    expect(r.affiliateCut).toBe(0);
  });
});
