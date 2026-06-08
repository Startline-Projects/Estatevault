// Single source of truth for EstateVault prices, splits, promo codes, and
// product metadata (integer cents). FIXED by CLAUDE.md — partners cannot
// change them. NEVER edit a value here to "clean up" — these are business law.

export const PRICES = {
  will: 40000,
  trust: 60000,
  attorneyReview: 30000,
  amendment: 5000,
  vaultSubscriptionYear: 9900,
} as const;

export const EV_DEFAULT_CUT = {
  will: 10000,
  trust: 20000,
  amendment: 5000,
} as const;

export const PARTNER_PLATFORM_FEE = {
  basic: 50000,
  standard: 120000,
  enterprise: 600000,
} as const;

export const DEFAULT_ATTORNEY_REVIEW_FEE = 30000;

export const ATTORNEY_REVIEW_FEE_RANGE = { min: 15000, max: 150000 } as const;

// `app_settings` key holding the admin-controlled platform-default attorney
// review fee (cents). Admin sets this; partners cannot. See ATTORNEY_REVIEW_FEE.
export const ATTORNEY_REVIEW_FEE_SETTING_KEY = "attorney_review_fee_default";

// Clamp any attorney-review fee (admin-set, per-partner or platform-default)
// into the allowed range. Single guard for BUG-4: an out-of-range value can
// never be charged or transferred. Non-finite input falls back to the default.
export function clampAttorneyReviewFee(cents: number): number {
  if (!Number.isFinite(cents)) return DEFAULT_ATTORNEY_REVIEW_FEE;
  return Math.min(
    ATTORNEY_REVIEW_FEE_RANGE.max,
    Math.max(ATTORNEY_REVIEW_FEE_RANGE.min, Math.round(cents)),
  );
}

export const PROMO_CODES = {
  FREE134: "free",
  TEST: "test",
  TPFP: "free",
  FREE676: "free",
} as const;

export type PromoCode = keyof typeof PROMO_CODES;

export const PARTNER_SPLITS: Record<
  string,
  Record<string, { ev: number; partner: number }>
> = {
  will: { standard: { ev: 10000, partner: 30000 }, enterprise: { ev: 5000, partner: 35000 } },
  trust: { standard: { ev: 20000, partner: 40000 }, enterprise: { ev: 15000, partner: 45000 } },
  amendment: { standard: { ev: 1500, partner: 3500 }, enterprise: { ev: 1000, partner: 4000 } },
  attorney_review: { standard: { ev: 0, partner: 0 }, enterprise: { ev: 0, partner: 0 } },
} as const;

export const AFFILIATE_SPLITS: Record<
  string,
  { ev: number; affiliate: number }
> = {
  will: { ev: 30000, affiliate: 10000 },
  trust: { ev: 40000, affiliate: 20000 },
  amendment: { ev: 5000, affiliate: 0 },
  attorney_review: { ev: 0, affiliate: 0 },
} as const;

export const PRODUCT_NAMES = {
  will: "Will Package",
  trust: "Trust Package",
  attorneyReview: "Attorney Review",
  amendment: "Document Amendment",
  vaultSubscription: "Vault Subscription",
} as const;

export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toFixed(2)}`;
}

export type ProductType = "will" | "trust" | "amendment" | "attorney_review";
export type PartnerTier = "basic" | "standard" | "enterprise";
