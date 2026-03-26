-- ============================================================
-- EstateVault — Complete Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  phone text,
  state text default 'Michigan',
  user_type text not null default 'client'
    check (user_type in ('client', 'partner', 'sales_rep', 'review_attorney', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, user_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'user_type', 'client')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PARTNERS
-- ============================================================
create table partners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  company_name text not null,
  business_url text,
  product_name text default 'Legacy Protection',
  tier text not null default 'standard'
    check (tier in ('standard', 'enterprise')),
  status text default 'onboarding'
    check (status in ('onboarding', 'active', 'suspended', 'cancelled')),
  logo_url text,
  accent_color text default '#C9A84C',
  subdomain text,
  custom_domain text,
  sender_name text,
  sender_email text,
  stripe_account_id text,
  annual_fee_paid boolean default false,
  annual_fee_paid_at timestamptz,
  onboarding_step integer default 1,
  onboarding_completed boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index partners_subdomain_unique on partners (subdomain) where subdomain is not null;
create unique index partners_custom_domain_unique on partners (custom_domain) where custom_domain is not null;

-- ============================================================
-- PARTNER RELATIONSHIPS (enterprise parent/child)
-- ============================================================
create table partner_relationships (
  id uuid primary key default gen_random_uuid(),
  parent_partner_id uuid references partners(id) on delete cascade,
  child_partner_id uuid references partners(id) on delete cascade,
  child_commission_pct numeric not null,
  parent_commission_pct numeric not null,
  created_at timestamptz default now()
);

-- ============================================================
-- CLIENTS
-- ============================================================
create table clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  partner_id uuid references partners(id) on delete set null,
  source text default 'direct'
    check (source in ('direct', 'partner')),
  state text default 'Michigan',
  advisor_name text,
  advisor_firm text,
  advisor_share_consent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- QUIZ SESSIONS
-- ============================================================
create table quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  partner_id uuid references partners(id) on delete set null,
  answers jsonb not null default '{}',
  recommendation text
    check (recommendation in ('will', 'trust', 'attorney_referral')),
  hard_stop_triggered boolean default false,
  hard_stop_reason text,
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ORDERS
-- ============================================================
create table orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  partner_id uuid references partners(id) on delete set null,
  quiz_session_id uuid references quiz_sessions(id) on delete set null,
  product_type text not null
    check (product_type in ('will', 'trust', 'attorney_review', 'amendment')),
  status text default 'pending'
    check (status in ('pending', 'paid', 'generating', 'review', 'delivered', 'refunded')),
  amount_total integer not null,
  ev_cut integer not null,
  partner_cut integer,
  attorney_cut integer,
  stripe_payment_intent_id text,
  stripe_session_id text,
  attorney_review_requested boolean default false,
  complexity_flag boolean default false,
  complexity_flag_reason text,
  acknowledgment_signed boolean default false,
  acknowledgment_signed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  document_type text not null
    check (document_type in ('will', 'trust', 'pour_over_will', 'poa', 'healthcare_directive')),
  template_version text not null,
  status text default 'pending'
    check (status in ('pending', 'generated', 'under_review', 'delivered')),
  storage_path text,
  generated_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- ATTORNEY REVIEWS
-- ============================================================
create table attorney_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  attorney_id uuid references profiles(id) on delete set null,
  status text default 'pending'
    check (status in ('pending', 'in_review', 'approved', 'approved_with_notes', 'flagged')),
  notes text,
  reviewed_at timestamptz,
  sla_deadline timestamptz,
  attorney_fee integer default 30000,
  created_at timestamptz default now()
);

-- ============================================================
-- VAULT ITEMS
-- ============================================================
create table vault_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  category text not null
    check (category in ('estate_document', 'insurance', 'financial_account', 'digital_account', 'physical_location', 'contact', 'final_wishes', 'business')),
  label text not null,
  data jsonb not null default '{}',
  is_encrypted boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- VAULT TRUSTEES
-- ============================================================
create table vault_trustees (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  trustee_name text not null,
  trustee_email text not null,
  trustee_relationship text,
  verified boolean default false,
  access_granted boolean default false,
  access_requested_at timestamptz,
  access_granted_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- MARKETING ASSETS
-- ============================================================
create table marketing_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null
    check (asset_type in ('email_template', 'social_post', 'print_flyer', 'brochure', 'presentation_slide', 'one_pager', 'script_card')),
  asset_name text not null,
  platform text,
  storage_path text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- REFERRALS
-- ============================================================
create table referrals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  partner_id uuid references partners(id) on delete set null,
  reason text not null,
  status text default 'pending'
    check (status in ('pending', 'contacted', 'converted', 'closed')),
  referral_fee integer default 7500,
  referral_fee_paid boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- PAYOUTS
-- ============================================================
create table payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references partners(id) on delete cascade,
  amount integer not null,
  status text default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  stripe_transfer_id text,
  payout_date date,
  orders_included jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb default '{}',
  ip_address text,
  created_at timestamptz default now()
);

-- ============================================================
-- UPDATED_AT TRIGGER (auto-update updated_at columns)
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();
create trigger set_updated_at before update on partners
  for each row execute function update_updated_at();
create trigger set_updated_at before update on clients
  for each row execute function update_updated_at();
create trigger set_updated_at before update on quiz_sessions
  for each row execute function update_updated_at();
create trigger set_updated_at before update on orders
  for each row execute function update_updated_at();
create trigger set_updated_at before update on vault_items
  for each row execute function update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_clients_profile_id on clients (profile_id);
create index idx_clients_partner_id on clients (partner_id);
create index idx_quiz_sessions_client_id on quiz_sessions (client_id);
create index idx_orders_client_id on orders (client_id);
create index idx_orders_partner_id on orders (partner_id);
create index idx_orders_status on orders (status);
create index idx_documents_order_id on documents (order_id);
create index idx_documents_client_id on documents (client_id);
create index idx_attorney_reviews_order_id on attorney_reviews (order_id);
create index idx_attorney_reviews_status on attorney_reviews (status);
create index idx_vault_items_client_id on vault_items (client_id);
create index idx_vault_trustees_client_id on vault_trustees (client_id);
create index idx_payouts_partner_id on payouts (partner_id);
create index idx_audit_log_actor_id on audit_log (actor_id);
create index idx_audit_log_action on audit_log (action);
create index idx_audit_log_created_at on audit_log (created_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table partners enable row level security;
alter table partner_relationships enable row level security;
alter table clients enable row level security;
alter table quiz_sessions enable row level security;
alter table orders enable row level security;
alter table documents enable row level security;
alter table attorney_reviews enable row level security;
alter table vault_items enable row level security;
alter table vault_trustees enable row level security;
alter table marketing_assets enable row level security;
alter table referrals enable row level security;
alter table payouts enable row level security;
alter table audit_log enable row level security;

-- Helper: get current user's profile type
create or replace function public.get_user_type()
returns text as $$
  select user_type from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper: get current user's partner id
create or replace function public.get_partner_id()
returns uuid as $$
  select id from public.partners where profile_id = auth.uid();
$$ language sql security definer stable;

-- Helper: get current user's client id
create or replace function public.get_client_id()
returns uuid as $$
  select id from public.clients where profile_id = auth.uid();
$$ language sql security definer stable;

-- ── PROFILES ──────────────────────────────────────────────
create policy "Users can read own profile"
  on profiles for select using (id = auth.uid());
create policy "Users can update own profile"
  on profiles for update using (id = auth.uid());
create policy "Admins can read all profiles"
  on profiles for select using (public.get_user_type() = 'admin');

-- ── PARTNERS ──────────────────────────────────────────────
create policy "Partners can read own record"
  on partners for select using (profile_id = auth.uid());
create policy "Partners can update own record"
  on partners for update using (profile_id = auth.uid());
create policy "Sales reps can read partners they created"
  on partners for select using (created_by = auth.uid());
create policy "Sales reps can insert partners"
  on partners for insert with check (
    public.get_user_type() in ('sales_rep', 'admin')
  );
create policy "Admins can read all partners"
  on partners for select using (public.get_user_type() = 'admin');
create policy "Admins can update all partners"
  on partners for update using (public.get_user_type() = 'admin');

-- ── PARTNER RELATIONSHIPS ─────────────────────────────────
create policy "Partners can read own relationships"
  on partner_relationships for select using (
    parent_partner_id = public.get_partner_id() or child_partner_id = public.get_partner_id()
  );
create policy "Admins can manage relationships"
  on partner_relationships for all using (public.get_user_type() = 'admin');

-- ── CLIENTS ───────────────────────────────────────────────
create policy "Clients can read own record"
  on clients for select using (profile_id = auth.uid());
create policy "Clients can update own record"
  on clients for update using (profile_id = auth.uid());
create policy "Clients can insert own record"
  on clients for insert with check (profile_id = auth.uid());
create policy "Partners can read their clients"
  on clients for select using (partner_id = public.get_partner_id());
create policy "Admins can read all clients"
  on clients for select using (public.get_user_type() = 'admin');

-- ── QUIZ SESSIONS ─────────────────────────────────────────
create policy "Clients can read own quiz sessions"
  on quiz_sessions for select using (client_id = public.get_client_id());
create policy "Clients can insert quiz sessions"
  on quiz_sessions for insert with check (client_id = public.get_client_id());
create policy "Clients can update own quiz sessions"
  on quiz_sessions for update using (client_id = public.get_client_id());
create policy "Partners can read their quiz sessions"
  on quiz_sessions for select using (partner_id = public.get_partner_id());
create policy "Admins can read all quiz sessions"
  on quiz_sessions for select using (public.get_user_type() = 'admin');

-- ── ORDERS ────────────────────────────────────────────────
create policy "Clients can read own orders"
  on orders for select using (client_id = public.get_client_id());
create policy "Partners can read their orders"
  on orders for select using (partner_id = public.get_partner_id());
create policy "Admins can manage all orders"
  on orders for all using (public.get_user_type() = 'admin');

-- ── DOCUMENTS ─────────────────────────────────────────────
create policy "Clients can read own documents"
  on documents for select using (client_id = public.get_client_id());
create policy "Admins can manage all documents"
  on documents for all using (public.get_user_type() = 'admin');
create policy "Review attorneys can read documents under review"
  on documents for select using (
    public.get_user_type() = 'review_attorney'
    and status = 'under_review'
  );

-- ── ATTORNEY REVIEWS ──────────────────────────────────────
create policy "Attorneys can read assigned reviews"
  on attorney_reviews for select using (attorney_id = auth.uid());
create policy "Attorneys can update assigned reviews"
  on attorney_reviews for update using (attorney_id = auth.uid());
create policy "Admins can manage all reviews"
  on attorney_reviews for all using (public.get_user_type() = 'admin');

-- ── VAULT ITEMS (strict — client only + admin) ───────────
create policy "Clients can read own vault items"
  on vault_items for select using (client_id = public.get_client_id());
create policy "Clients can insert own vault items"
  on vault_items for insert with check (client_id = public.get_client_id());
create policy "Clients can update own vault items"
  on vault_items for update using (client_id = public.get_client_id());
create policy "Clients can delete own vault items"
  on vault_items for delete using (client_id = public.get_client_id());
create policy "Admins can read all vault items"
  on vault_items for select using (public.get_user_type() = 'admin');

-- ── VAULT TRUSTEES ────────────────────────────────────────
create policy "Clients can manage own trustees"
  on vault_trustees for all using (client_id = public.get_client_id());
create policy "Admins can read all trustees"
  on vault_trustees for select using (public.get_user_type() = 'admin');

-- ── MARKETING ASSETS ──────────────────────────────────────
create policy "Partners can read active marketing assets"
  on marketing_assets for select using (is_active = true and public.get_user_type() in ('partner', 'admin'));
create policy "Admins can manage marketing assets"
  on marketing_assets for all using (public.get_user_type() = 'admin');

-- ── REFERRALS ─────────────────────────────────────────────
create policy "Partners can read their referrals"
  on referrals for select using (partner_id = public.get_partner_id());
create policy "Admins can manage all referrals"
  on referrals for all using (public.get_user_type() = 'admin');

-- ── PAYOUTS ───────────────────────────────────────────────
create policy "Partners can read own payouts"
  on payouts for select using (partner_id = public.get_partner_id());
create policy "Admins can manage all payouts"
  on payouts for all using (public.get_user_type() = 'admin');

-- ── AUDIT LOG ─────────────────────────────────────────────
create policy "Authenticated users can insert audit entries"
  on audit_log for insert with check (auth.uid() is not null);
create policy "Admins can read all audit entries"
  on audit_log for select using (public.get_user_type() = 'admin');
