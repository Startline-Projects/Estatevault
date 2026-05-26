import { describe, it, expect, beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy";
});

// stripe-payouts pulls in the Stripe SDK transitively; stub it like the
// calculate-split test does so this runs without live credentials.
vi.mock("stripe", () => ({
  default: class {
    transfers = { create: vi.fn() };
    accounts = { create: vi.fn(), retrieve: vi.fn() };
    accountLinks = { create: vi.fn() };
  },
}));

import {
  PRICES,
  EV_DEFAULT_CUT,
  PARTNER_PLATFORM_FEE,
  DEFAULT_ATTORNEY_REVIEW_FEE,
  PROMO_CODES,
} from "@/lib/orders/pricing";
import { calculateSplit } from "@/lib/stripe-payouts";

// Characterization: these are the amounts checkout charges today and the prices
// fixed by CLAUDE.md. If a future refactor wires routes to PRICES and a value
// drifts, this test fails — which is the point.
describe("PRICES — fixed by CLAUDE.md (cents)", () => {
  it("matches the published price list", () => {
    expect(PRICES.will).toBe(40000); // $400
    expect(PRICES.trust).toBe(60000); // $600
    expect(PRICES.attorneyReview).toBe(30000); // $300
    expect(PRICES.amendment).toBe(5000); // $50
    expect(PRICES.vaultSubscriptionYear).toBe(9900); // $99/yr
  });

  it("keeps partner platform fees by tier", () => {
    expect(PARTNER_PLATFORM_FEE.basic).toBe(50000);
    expect(PARTNER_PLATFORM_FEE.standard).toBe(120000);
    expect(PARTNER_PLATFORM_FEE.enterprise).toBe(600000);
  });

  it("keeps the default attorney review fee", () => {
    expect(DEFAULT_ATTORNEY_REVIEW_FEE).toBe(30000);
  });

  it("knows the recognized promo codes", () => {
    expect(PROMO_CODES.FREE134).toBe("free");
    expect(PROMO_CODES.TEST).toBe("test");
    expect(PROMO_CODES.TPFP).toBe("free");
  });
});

// Invariant tying the SSOT to the revenue-split logic: a direct (no-partner)
// sale's EV cut + partner cut must equal the product price.
describe("PRICES reconcile with calculateSplit", () => {
  it("will: ev + partner == price", () => {
    const s = calculateSplit("will", "standard");
    expect(s.evCut + s.partnerCut).toBe(PRICES.will);
  });
  it("trust: ev + partner == price", () => {
    const s = calculateSplit("trust", "standard");
    expect(s.evCut + s.partnerCut).toBe(PRICES.trust);
  });
  it("amendment: ev + partner == price", () => {
    const s = calculateSplit("amendment", "standard");
    expect(s.evCut + s.partnerCut).toBe(PRICES.amendment);
  });
  it("will direct EV cut matches the legacy default", () => {
    expect(calculateSplit("will", "standard").evCut).toBe(EV_DEFAULT_CUT.will);
    expect(calculateSplit("trust", "standard").evCut).toBe(EV_DEFAULT_CUT.trust);
  });
});
