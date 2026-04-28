Affiliate Program — Implementation Plan
Context

EstateVault needs a free, public affiliate program: anyone can sign up, get a permanent referral link, and earn commission on purchases that flow through
their link. New revenue channel beyond Professional Partners and Sales Reps.

Commission structure (fixed):
- Will purchase ($400) → affiliate earns $100, EV keeps $300
- Trust purchase ($600) → affiliate earns $200, EV keeps $400
- Attorney-review add-on, amendments → no affiliate cut
- Affiliate referral links never expire

User decisions confirmed:
- Cookie attribution window: 90 days
- Payouts: Stripe Connect required at signup (mirrors attorney-partner pattern, automated transfers)
- Conflict resolution: whichever path the visitor used to reach checkout wins — partner URL /{partner-slug}/... → partner gets paid; main-site checkout with
affiliate cookie → affiliate gets paid
- Attorney-review revenue: excluded from affiliate earnings

---
Architecture

Storage model

New affiliates table rather than overloading partners. Partners have heavy onboarding (white-label, custom domains, attorney-review routing, RLS). Affiliates
are lightweight. New 'affiliate' value added to profiles.user_type enum so they can log in via existing /auth/login.

Link format: /a/{code}

- 8-char base32 code (e.g. J7K2X9PQ)
- Route handler at app/a/[code]/route.ts: increments click counter, sets cookie, 302-redirects to /
- 'a', 'affiliate', 'affiliate-signup' added to reserved slug list in app/[partner-slug]/page.tsx so they don't collide with partner slugs

Attribution

- Cookie: ev_aff = affiliate UUID. HttpOnly; Secure; SameSite=Lax; Max-Age=7776000 (90 days). Set on /a/{code} hit.
- At checkout: if (partnerId in body) → partner attribution; else if (ev_aff cookie) → affiliate attribution. Partner URL flow naturally beats affiliate
cookie because partner pages pass partnerId in checkout body.

Payouts via Stripe Connect Express (required at signup)

Mirrors app/partners/attorneys/signup/page.tsx 3-step flow:
1. Account details (name, email, password)
2. Stripe Connect Express onboarding link (collects SSN/bank/tax info)
3. Confirmation + reveal of permanent referral link

Earnings flow: webhook fires on order paid → calls transferToAffiliate() (new helper, mirrors transferToPartner in lib/stripe-payouts.ts) → records row in
affiliate_payouts.

---
Database Schema

New migration: supabase/migrations/20260428_000_affiliate_program.sql

-- Add 'affiliate' to profiles.user_type enum
alter table profiles drop constraint profiles_user_type_check;
alter table profiles add constraint profiles_user_type_check
  check (user_type in ('client','partner','sales_rep','review_attorney','admin','affiliate'));

create table affiliates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  code text not null unique,
  full_name text not null,
  email text not null,
  stripe_account_id text,                          -- Connect Express account
  stripe_onboarding_complete boolean default false,
  status text default 'pending_onboarding'
    check (status in ('pending_onboarding','active','suspended')),
  total_clicks integer default 0,
  total_conversions integer default 0,
  total_earned_cents integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index affiliates_profile_id_unique on affiliates(profile_id);
create index affiliates_code_idx on affiliates(code);

create table affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  ip_hash text,
  user_agent text,
  referrer text,
  landing_path text,
  converted boolean default false,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz default now()
);
create index affiliate_clicks_affiliate_id_idx on affiliate_clicks(affiliate_id, created_at desc);

alter table orders add column affiliate_id uuid references affiliates(id) on delete set null;
alter table orders add column affiliate_cut integer default 0;
create index orders_affiliate_id_idx on orders(affiliate_id);

create table affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount_cents integer not null,
  status text default 'pending'
    check (status in ('pending','processing','sent','failed','reversed')),
  stripe_transfer_id text,
  orders_included jsonb,
  paid_at timestamptz,
  created_at timestamptz default now()
);
create index affiliate_payouts_affiliate_id_idx on affiliate_payouts(affiliate_id);

-- RLS
alter table affiliates enable row level security;
alter table affiliate_clicks enable row level security;
alter table affiliate_payouts enable row level security;

create or replace function public.get_affiliate_id() returns uuid language sql stable as $$
  select id from affiliates where profile_id = auth.uid();
$$;

create policy "Affiliates read own record" on affiliates
  for select using (profile_id = auth.uid() or public.get_user_type() = 'admin');
create policy "Affiliates read own clicks" on affiliate_clicks
  for select using (affiliate_id = public.get_affiliate_id() or public.get_user_type() = 'admin');
create policy "Affiliates read own payouts" on affiliate_payouts
  for select using (affiliate_id = public.get_affiliate_id() or public.get_user_type() = 'admin');
create policy "Admins manage affiliates" on affiliates
  for all using (public.get_user_type() = 'admin');
create policy "Admins manage affiliate_clicks" on affiliate_clicks
  for all using (public.get_user_type() = 'admin');
create policy "Admins manage affiliate_payouts" on affiliate_payouts
  for all using (public.get_user_type() = 'admin');

-- Atomic counter bump (called from webhook)
create or replace function public.increment_affiliate_stats(
  p_affiliate_id uuid, p_earned_cents integer
) returns void language sql as $$
  update affiliates set
    total_conversions = total_conversions + 1,
    total_earned_cents = total_earned_cents + p_earned_cents,
    updated_at = now()
  where id = p_affiliate_id;
$$;

---
Files to Create

┌────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          Path                          │                                             Purpose                                             │
├────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ supabase/migrations/20260428_000_affiliate_program.sql │ Schema + RLS + RPC                                                                              │
├────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/a/[code]/route.ts                                  │ Click tracking + cookie + redirect                                                              │
├────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/affiliate-signup/page.tsx                          │ 3-step signup (account → Stripe Connect → link reveal). Mirrors                                 │
│                                                        │ app/partners/attorneys/signup/page.tsx UX patterns.                                             │
├────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/affiliate/page.tsx                                 │ Dashboard (server component, gated user_type='affiliate'). Shows referral link with copy        │
│                                                        │ button, stats (clicks/conversions/earnings), recent orders, payouts.                            │
├────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/affiliate/layout.tsx                               │ Auth gate + minimal chrome                                                                      │
├────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/api/affiliate/signup/route.ts                      │ Account creation + Stripe Connect Express account create                                        │
├────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/api/affiliate/onboarding/route.ts                  │ Resume/refresh Stripe Connect onboarding link                                                   │
├────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/api/affiliate/onboarding/callback/route.ts         │ Stripe Connect return URL — flips stripe_onboarding_complete=true and status='active'           │
├────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ lib/affiliate.ts                                       │ generateAffiliateCode(), getAffiliateFromCookie(), setAffiliateCookie(), helpers                │
├────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ components/AffiliateLinkCard.tsx                       │ Copy-to-clipboard component                                                                     │
└────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────┘

Files to Modify

┌──────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│               Path               │                                                        Change                                                         │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ components/Header.tsx            │ Add { label: "Become an Affiliate", href: "/affiliate-signup" } to navLinks array (line 7-13). Renders in both        │
│                                  │ desktop nav + mobile menu automatically.                                                                              │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                  │ Extend calculateSplit(productType, tier, opts?: { affiliate?: boolean }) returning { evCut, partnerCut, affiliateCut  │
│ lib/stripe-payouts.ts            │ }. Affiliate branch: will → ev=$300, aff=$100; trust → ev=$400, aff=$200; amendment+attorney_review → aff=0. Add      │
│                                  │ transferToAffiliate(stripeAccountId, amount, orderId, affiliateId, productType) helper mirroring transferToPartner.   │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ lib/validation/schemas.ts        │ Add affiliateSignupSchema (fullName, email, password ≥8, acceptTerms). Use /new-zod-schema skill.                     │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                  │ Read ev_aff cookie via cookies(). If no partnerId in body and cookie present, set affiliateId, recalc split with {    │
│ app/api/checkout/will/route.ts   │ affiliate: true }, write affiliate_id + affiliate_cut on order, add affiliate_id to Stripe session metadata. Mark     │
│                                  │ latest unconverted affiliate_clicks row converted.                                                                    │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/api/checkout/trust/route.ts  │ Same as will route.                                                                                                   │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/api/webhooks/stripe/route.ts │ New branch: if metadata.affiliate_id present, call transferToAffiliate() to affiliate's stripe_account_id, insert     │
│                                  │ affiliate_payouts row with stripe_transfer_id, RPC increment_affiliate_stats, audit log affiliate.conversion.         │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/[partner-slug]/page.tsx      │ Add 'a', 'affiliate', 'affiliate-signup' to reserved slug array.                                                      │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ app/auth/login/page.tsx          │ Extend post-login redirect: user_type='affiliate' → /affiliate.                                                       │
├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ lib/supabase/middleware.ts       │ Verify /a/*, /affiliate-signup, /api/affiliate/* are public (no auth gate).                                           │
└──────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

---
Reused Patterns

- Signup 3-step UX: app/partners/attorneys/signup/page.tsx (lines 1-651) — progress indicator, step validation, Stripe Connect handoff
- Auth signup: app/auth/signup/page.tsx — Supabase signUp with user_type metadata, error display pattern
- Stripe Connect transfer: transferToPartner() in lib/stripe-payouts.ts — copy shape for transferToAffiliate()
- Revenue stats query: app/api/partner/revenue/route.ts — copy MTD/YTD/all-time pattern for affiliate dashboard
- Input + button styling: see app/auth/signup/page.tsx (light card) and app/partners/attorneys/signup/page.tsx (dark navy bg) — pick light card pattern
- Tailwind brand classes: navy, gold, charcoal from tailwind.config.ts

---
Implementation Order

1. Migration (schema + RLS + RPC) — foundation
2. lib/stripe-payouts.ts (calculateSplit extension + transferToAffiliate) + lib/affiliate.ts + lib/validation/schemas.ts — pure logic
3. app/a/[code]/route.ts + reserved-slug update — click tracking live
4. /api/affiliate/signup + /api/affiliate/onboarding + /api/affiliate/onboarding/callback — backend signup
5. /affiliate-signup 3-step page — frontend signup
6. /affiliate dashboard + post-login redirect — affiliate UX
7. Checkout route changes (will + trust) + webhook changes — conversion loop
8. Header.tsx nav link — exposes program publicly
9. Test full flow end-to-end (Stripe test mode)

Each step shippable independently. Nav button last so program isn't promoted before plumbing is verified.

---
Verification

1. Migration applies cleanly: supabase db push (or local supabase db reset)
2. Signup flow:
  - Visit /affiliate-signup → fill form → redirected to Stripe Connect onboarding
  - Complete Connect Express test onboarding → returns to /affiliate dashboard
  - Verify affiliates row exists, status='active', stripe_account_id populated
3. Link tracking:
  - Visit /a/{code} → cookie ev_aff set → redirected to /
  - affiliate_clicks row inserted, total_clicks incremented
4. Conversion (will):
  - Hit /a/{code} → navigate quiz → checkout
  - Complete Stripe test purchase ($400 will)
  - orders row: affiliate_id set, affiliate_cut=10000, ev_cut=30000, partner_id=null
  - Webhook fires → affiliate_payouts row status='sent', stripe_transfer_id populated
  - Affiliate's Stripe Express balance reflects $100
  - affiliates.total_conversions=1, total_earned_cents=10000
5. Conversion (trust): same, $600 → affiliate $200, ev $400
6. Conflict test: hit /a/{code} (cookie set) → navigate to /{partner-slug}/ → checkout from partner page → order's partner_id set, affiliate_id=null, partner
gets paid
7. Refund: Stripe refund webhook → mark affiliate_payouts.status='reversed' (optional v1.1 — flag if not in scope)
8. Nav: "Become an Affiliate" link visible on desktop + mobile menus
9. Type check + build: npm run build clean
10. Dashboard reflects state: clicks, conversions, earnings, link copy works

---
Out of Scope (v1)

- Affiliate marketing assets library (banners, social copy templates) — placeholder section, content later
- Tiered commission structure (more conversions = higher rate)
- Sub-affiliates / multi-level
- Refund clawback automation (manual admin action for now; flag in webhook todo)
- First-touch attribution alternative (using last-touch / entry-path as decided)