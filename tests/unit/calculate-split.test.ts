import { describe, it, expect, beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy";
});

vi.mock("stripe", () => ({
  default: class {
    transfers = { create: vi.fn() };
    accounts = { create: vi.fn(), retrieve: vi.fn() };
    accountLinks = { create: vi.fn() };
  },
}));

import { calculateSplit } from "@/lib/stripe-payouts";

describe("calculateSplit — partner tier", () => {
  it("will / standard → $300 partner / $100 EV", () => {
    expect(calculateSplit("will", "standard")).toEqual({ evCut: 10000, partnerCut: 30000, affiliateCut: 0 });
  });

  it("will / enterprise → $350 partner / $50 EV", () => {
    expect(calculateSplit("will", "enterprise")).toEqual({ evCut: 5000, partnerCut: 35000, affiliateCut: 0 });
  });

  it("trust / standard → $400 partner / $200 EV", () => {
    expect(calculateSplit("trust", "standard")).toEqual({ evCut: 20000, partnerCut: 40000, affiliateCut: 0 });
  });

  it("trust / enterprise → $450 partner / $150 EV", () => {
    expect(calculateSplit("trust", "enterprise")).toEqual({ evCut: 15000, partnerCut: 45000, affiliateCut: 0 });
  });

  it("amendment / standard → $35 partner / $15 EV", () => {
    expect(calculateSplit("amendment", "standard")).toEqual({ evCut: 1500, partnerCut: 3500, affiliateCut: 0 });
  });

  it("attorney_review → 0 partner cut (100% to attorney handled elsewhere)", () => {
    expect(calculateSplit("attorney_review", "standard")).toEqual({ evCut: 0, partnerCut: 0, affiliateCut: 0 });
  });

  it("unknown product → all zeros", () => {
    expect(calculateSplit("unknown_product", "standard")).toEqual({ evCut: 0, partnerCut: 0, affiliateCut: 0 });
  });
});

describe("calculateSplit — affiliate path", () => {
  it("will / affiliate → $300 EV / $100 affiliate / 0 partner", () => {
    expect(calculateSplit("will", "standard", { affiliate: true })).toEqual({ evCut: 30000, partnerCut: 0, affiliateCut: 10000 });
  });

  it("trust / affiliate → $400 EV / $200 affiliate / 0 partner", () => {
    expect(calculateSplit("trust", "standard", { affiliate: true })).toEqual({ evCut: 40000, partnerCut: 0, affiliateCut: 20000 });
  });

  it("amendment / affiliate → $50 EV / $0 affiliate", () => {
    expect(calculateSplit("amendment", "standard", { affiliate: true })).toEqual({ evCut: 5000, partnerCut: 0, affiliateCut: 0 });
  });

  it("attorney_review / affiliate → all zeros", () => {
    expect(calculateSplit("attorney_review", "standard", { affiliate: true })).toEqual({ evCut: 0, partnerCut: 0, affiliateCut: 0 });
  });
});

describe("calculateSplit — totals invariant", () => {
  const cases: Array<[string, "standard" | "enterprise", number]> = [
    ["will", "standard", 40000],
    ["will", "enterprise", 40000],
    ["trust", "standard", 60000],
    ["trust", "enterprise", 60000],
    ["amendment", "standard", 5000],
    ["amendment", "enterprise", 5000],
  ];
  it.each(cases)("%s / %s splits sum to fixed price (%i cents)", (product, tier, total) => {
    const s = calculateSplit(product, tier);
    expect(s.evCut + s.partnerCut).toBe(total);
  });
});
