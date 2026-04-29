-- ============================================================
-- AFFILIATE PROGRAM
-- Public, lightweight referral program with Stripe Connect payouts
-- ============================================================

-- Add 'affiliate' to profiles.user_type enum
alter table profiles drop constraint profiles_user_type_check;
alter table profiles add constraint profiles_user_type_check
  check (user_type in ('client','partner','sales_rep','review_attorney','admin','affiliate'));

-- ============================================================
-- AFFILIATES
-- ============================================================
create table affiliates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  code text not null unique,
  full_name text not null,
  email text not null,
  stripe_account_id text,
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

create trigger set_updated_at before update on affiliates
  for each row execute function update_updated_at();

-- ============================================================
-- AFFILIATE CLICKS
-- ============================================================
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

-- ============================================================
-- ORDERS: add affiliate columns
-- ============================================================
alter table orders add column affiliate_id uuid references affiliates(id) on delete set null;
alter table orders add column affiliate_cut integer default 0;
create index orders_affiliate_id_idx on orders(affiliate_id);

-- ============================================================
-- AFFILIATE PAYOUTS
-- ============================================================
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

-- ============================================================
-- RLS
-- ============================================================
alter table affiliates enable row level security;
alter table affiliate_clicks enable row level security;
alter table affiliate_payouts enable row level security;

create or replace function public.get_affiliate_id() returns uuid
  language sql stable security definer as $$
  select id from affiliates where profile_id = auth.uid();
$$;

create policy "Affiliates read own record" on affiliates
  for select using (profile_id = auth.uid() or public.get_user_type() = 'admin');
create policy "Affiliates update own record" on affiliates
  for update using (profile_id = auth.uid());
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

-- ============================================================
-- RPC: increment_affiliate_stats (called from webhook)
-- ============================================================
create or replace function public.increment_affiliate_stats(
  p_affiliate_id uuid,
  p_earned_cents integer
) returns void
  language sql security definer as $$
  update affiliates set
    total_conversions = total_conversions + 1,
    total_earned_cents = total_earned_cents + p_earned_cents,
    updated_at = now()
  where id = p_affiliate_id;
$$;

-- ============================================================
-- RPC: increment_affiliate_clicks (called from /a/[code] route)
-- ============================================================
create or replace function public.increment_affiliate_clicks(
  p_affiliate_id uuid
) returns void
  language sql security definer as $$
  update affiliates set
    total_clicks = total_clicks + 1,
    updated_at = now()
  where id = p_affiliate_id;
$$;
