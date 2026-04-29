# Plan: Basic Partner Tier — White-Label Vault

## Context
EstateVault currently has Standard ($1,200) and Enterprise ($6,000) partner tiers that white-label the full estate planning platform (wills, trusts, vault). User wants a new **Basic Partner** tier ($500 one-time) that only gives access to the white-labeled vault — no document generation, no revenue splits. Basic Partners can brand the vault (logo, color, name, subdomain) during onboarding and edit later in dashboard.

---

## Scope of Changes

### Phase 1 — Database Migration
**File:** `/supabase/migrations/migration-basic-partner.sql`

1. Add `'basic'` to the `tier` enum/check in `partners` table
2. Add columns to `partners` table:
   - `vault_tagline text` — hero text on vault landing page (e.g. "Secure your legacy")
   - `vault_theme text default 'light'` — 'light' | 'dark' base theme
   - `vault_subdomain text unique` — separate subdomain for vault (e.g. `acme.estatevault.us`)
3. Update RLS policies — Basic partners have same partner-level access scoped to vault-only clients

**Note:** Reuse existing columns: `logo_url`, `accent_color`, `product_name`, `company_name`, `subdomain`

---

### Phase 2 — Stripe Product

**File:** `/app/api/checkout/partner/route.ts`

Add Basic tier checkout:
```ts
if (tier === 'basic') {
  priceData = { unit_amount: 50000, currency: 'usd' } // $500
  metadata = { type: 'partner_platform_fee', tier: 'basic' }
}
```

**File:** `/app/api/webhooks/stripe/route.ts`
- `checkout.session.completed` — already handles `partner_platform_fee`, just ensure `tier: 'basic'` sets correct `onboarding_step`

No Stripe Connect needed for Basic (no revenue splits).

---

### Phase 3 — Admin: Add Basic Tier in Create-Partner Form

**File:** `/app/pro/sales/new-partner/page.tsx`

Add `'basic'` to the Plan Tier dropdown:
- Basic — White-Label Vault Only ($500)
- Standard — Full Platform ($1,200)
- Enterprise — Full Platform ($6,000)

**File:** `/app/api/sales/create-partner/route.ts`

Handle `tier === 'basic'`:
- Skip Stripe Connect setup (no payouts)
- Set `onboarding_step: 1`
- Send welcome email variant for vault-only plan

---

### Phase 4 — Basic Partner Onboarding (3 Steps)

Reuse existing onboarding shell. Basic partners skip steps 3-7 (pricing, attorney, Stripe Connect, training, marketing).

**Step 1** (existing `/app/pro/onboarding/step-1/page.tsx`):
- Show Basic plan card ($500, vault-only)
- Add conditional: hide Standard/Enterprise ROI calculator for basic tier
- Stripe checkout → on success → `onboarding_step: 2`

**Step 2** — Brand Your Vault  
**File:** `/app/pro/onboarding/step-2-vault/page.tsx` (new, or modify step-2 with tier branching)
- Company name
- Product name (e.g. "Smith Wealth Vault")
- Logo upload (reuse existing upload logic from step-2)
- Accent color picker
- Vault tagline (short hero text)
- Theme: Light / Dark
- Live preview showing branded vault landing page
- Save → `onboarding_step: 3`

**Step 3** — Choose Your Subdomain  
**File:** `/app/pro/onboarding/step-3-vault/page.tsx` (new)
- Input: desired subdomain prefix → `{input}.estatevault.us`
- Availability check (query `vault_subdomain` unique column)
- Register via Vercel API (reuse `registerVercelDomain()` from `/app/api/partner/add-domain/route.ts`)
- Save `vault_subdomain` → `onboarding_completed: true`, redirect to Basic dashboard

---

### Phase 5 — White-Label Vault Landing Page

**File:** `/app/[partner-slug]/vault/page.tsx` (new route)

Branded landing page for end-clients of Basic Partners:
- Header: partner logo + company name in accent color
- Hero: product name + vault_tagline + CTA "Secure My Documents"
- Feature list (6 vault categories)
- Trustee feature explanation
- Farewell video feature
- Pricing: $99/year vault subscription
- Sign up / log in → routes to vault with `?partner={slug}`

Client onboarding via this page:
- Creates client profile with `partner_id` = Basic Partner's ID
- Proceeds to vault PIN setup + subscription checkout (`/api/checkout/vault-subscription`)

**Subdomain routing:** existing `middleware.ts` already rewrites custom subdomains → extend to also match `vault_subdomain` column. Rewrite `{slug}.estatevault.us` → `/[partner-slug]/vault`

---

### Phase 6 — Basic Partner Dashboard

**File:** `/app/pro/dashboard/page.tsx` (add tier-conditional rendering)

For `tier === 'basic'`, show simplified dashboard:
- Vault clients count
- Active vault subscriptions count
- "Your Vault URL" card with copy button
- Recent vault client sign-ups

Hide from Basic: earnings cards, document stats, certification module, marketing toolkit, training.

**Nav** (`/app/pro/` layout): hide links not relevant to Basic (Revenue, Documents, Training, Marketing).

---

### Phase 7 — Vault Branding Settings (Post-Onboarding)

**File:** `/app/pro/settings/page.tsx`

Add new section "Vault Branding" (visible only when `tier === 'basic'`):
- Company name
- Product name
- Logo upload
- Accent color
- Vault tagline
- Theme toggle
- Subdomain display (read-only after set) + "Request Change" support link
- Live preview panel

Existing Standard/Enterprise brand settings section already handles logo/color — just ensure Basic Partners also see these.

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration: add `basic` tier, `vault_tagline`, `vault_theme`, `vault_subdomain` columns |
| `app/pro/sales/new-partner/page.tsx` | Add Basic tier option to dropdown |
| `app/api/sales/create-partner/route.ts` | Handle basic tier creation |
| `app/api/checkout/partner/route.ts` | Add $500 Basic tier checkout |
| `app/api/webhooks/stripe/route.ts` | Handle basic tier webhook |
| `app/pro/onboarding/step-1/page.tsx` | Show Basic plan card |
| `middleware.ts` | Match `vault_subdomain` for routing |
| `app/pro/dashboard/page.tsx` | Tier-conditional dashboard |
| `app/pro/settings/page.tsx` | Vault branding section for basic tier |

## New Files to Create

| File | Purpose |
|------|---------|
| `app/pro/onboarding/step-2-vault/page.tsx` | Vault branding step |
| `app/pro/onboarding/step-3-vault/page.tsx` | Subdomain selection step |
| `app/[partner-slug]/vault/page.tsx` | White-label vault landing page |
| `app/api/partner/vault-subdomain/route.ts` | Check subdomain availability + register |

---

## Revenue Model
Basic Partner pays $500 once. Their clients pay $99/yr vault subscription — 100% goes to Partner Tha bogth our white labled. No revenue split.

---

## Verification

1. Admin creates Basic partner → tier shows 'basic', Stripe checkout is $500
2. Basic partner onboards: pays → brands vault → picks subdomain
3. Visit `{subdomain}.estatevault.us` → see branded vault landing page
4. Client signs up via that page → vault works with branding
5. Basic partner sees simplified dashboard with vault client count
6. Basic partner edits branding in settings → vault page updates
