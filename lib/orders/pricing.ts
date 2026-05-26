// Single source of truth for EstateVault prices (integer cents) and promo codes.
//
// These are FIXED by CLAUDE.md — partners cannot change them. The values mirror
// the amounts currently charged inline across app/api/checkout/* (verified at
// source). Phase 5 of the refactor wires the routes to import from here; until
// then this file + its test act as a characterization "before photo" so any
// drift in the real charges is caught by `pricing.test.ts`.
//
// NEVER edit a value here to "clean up" — these are business law.

// Product prices charged to the end client.
export const PRICES = {
  will: 40000, // $400  — checkout/will/route.ts:213
  trust: 60000, // $600  — checkout/trust/route.ts:193
  attorneyReview: 30000, // $300  — attorney-review add-on, checkout/{will,trust}
  amendment: 5000, // $50   — checkout/amendment/route.ts:85
  vaultSubscriptionYear: 9900, // $99/yr — checkout/vault-subscription/route.ts:172
} as const;

// EstateVault's default cut on a direct (no-partner) sale, per product. The
// partner/affiliate splits themselves live in lib/stripe-payouts.ts
// (calculateSplit) and are NOT duplicated here.
export const EV_DEFAULT_CUT = {
  will: 10000, // $100 — checkout/will/route.ts:218
  trust: 20000, // $200 — checkout/trust/route.ts:198
  amendment: 5000, // $50  — checkout/amendment/route.ts:79
} as const;

// One-time partner platform fee by tier.
export const PARTNER_PLATFORM_FEE = {
  basic: 50000, // $500   — checkout/partner/route.ts:19
  standard: 120000, // $1,200 — checkout/partner/route.ts:19, checkout/attorney/route.ts:140
  enterprise: 600000, // $6,000 — checkout/partner/route.ts:19, checkout/attorney/route.ts:140
} as const;

// Default attorney custom review fee when none is set.
export const DEFAULT_ATTORNEY_REVIEW_FEE = 30000; // $300

// Promo codes recognized across checkout routes (today redefined per-route).
// Value = the behavior the code triggers.
export const PROMO_CODES = {
  FREE134: "free", // free will/trust — checkout/{will,trust}
  TEST: "test", // gated $0 test order — checkout/{will,trust}
  TPFP: "free", // free attorney partner signup — checkout/attorney
} as const;

export type ProductType = "will" | "trust" | "amendment" | "attorney_review";
export type PartnerTier = "basic" | "standard" | "enterprise";
