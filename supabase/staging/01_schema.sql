-- ============================================================================
-- EstateVault-staging schema
-- Extracted read-only from production (onstztnksotijxxjxgyq) on 2026-09-16.
-- Target: ededvmvmgrqqeqcemsuz (EstateVault-staging) ONLY.
--
-- Structure only. No rows are copied. auth.users stays empty by design; the
-- smoke test creates its own accounts.
--
-- Run order: 01_schema.sql → 02_rls.sql → 03_storage.sql → 04_fixups.sql
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- supabase_vault is provisioned by Supabase itself; left out deliberately.

-- ── Functions ───────────────────────────────────────────────────────────────
-- NOTE: production's public.exec_sql(text) is deliberately NOT reproduced here.
-- See 04_fixups.sql and the accompanying report: it is SECURITY DEFINER owned by
-- postgres with EXECUTE granted to anon, i.e. arbitrary SQL as superuser for
-- anyone holding the public anon key. Staging must not inherit it.

CREATE OR REPLACE FUNCTION public.get_user_type()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  select user_type from public.profiles where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_client_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  select id from public.clients where profile_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_partner_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  select id from public.partners where profile_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_affiliate_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  select id from affiliates where profile_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_partner_login_target(p_partner_id uuid)
 RETURNS TABLE(subdomain text, custom_domain text, vault_subdomain text, company_name text)
 LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
    select p.subdomain, p.custom_domain, p.vault_subdomain, p.company_name
    from public.partners p
    where p.id = p_partner_id
      and exists (
        select 1 from public.clients c
        where c.partner_id = p.id
          and c.profile_id = auth.uid()
      );
  $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.increment_affiliate_clicks(p_affiliate_id uuid)
 RETURNS void LANGUAGE sql SECURITY DEFINER
AS $function$
  update affiliates set
    total_clicks = total_clicks + 1,
    updated_at = now()
  where id = p_affiliate_id;
$function$;

CREATE OR REPLACE FUNCTION public.increment_affiliate_stats(p_affiliate_id uuid, p_earned_cents integer)
 RETURNS void LANGUAGE sql SECURITY DEFINER
AS $function$
  update affiliates set
    total_conversions = total_conversions + 1,
    total_earned_cents = total_earned_cents + p_earned_cents,
    updated_at = now()
  where id = p_affiliate_id;
$function$;

CREATE OR REPLACE FUNCTION public.slugify_simple(input text)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$function$;

CREATE OR REPLACE FUNCTION public.partners_autoslug()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.marketing_slug IS NULL AND NEW.company_name IS NOT NULL THEN
    NEW.marketing_slug = slugify_simple(NEW.company_name);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_marketing_materials_updated_at()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- ── Tables (29) ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  phone text,
  state text DEFAULT 'Michigan'::text,
  user_type text NOT NULL DEFAULT 'client'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  vault_pin_hash text,
  notification_preferences jsonb DEFAULT '{"annual_review": true, "documents_delivered": true, "life_event_reminders": true}'::jsonb,
  last_login_at timestamp with time zone,
  commission_rate numeric DEFAULT 0.05,
  requires_password_change boolean DEFAULT false,
  is_payroll boolean DEFAULT false,
  bar_number text,
  bar_verified boolean DEFAULT false,
  bar_verified_at timestamp with time zone,
  managed_by_admin uuid
);

CREATE TABLE IF NOT EXISTS public.partners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  company_name text NOT NULL,
  business_url text,
  product_name text DEFAULT 'Legacy Protection'::text,
  tier text NOT NULL DEFAULT 'standard'::text,
  status text DEFAULT 'onboarding'::text,
  logo_url text,
  accent_color text DEFAULT '#C9A84C'::text,
  subdomain text,
  custom_domain text,
  sender_name text,
  sender_email text,
  stripe_account_id text,
  annual_fee_paid boolean DEFAULT false,
  annual_fee_paid_at timestamp with time zone,
  onboarding_step integer DEFAULT 1,
  onboarding_completed boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  partner_slug text,
  mfa_enabled boolean DEFAULT false,
  certification_completed boolean DEFAULT false,
  certification_completed_at timestamp with time zone,
  created_by_notes text,
  prospect_source text,
  custom_review_fee integer DEFAULT 30000,
  bar_number text,
  practice_areas text[],
  professional_type text,
  one_time_fee_paid boolean DEFAULT false,
  one_time_fee_amount integer DEFAULT 0,
  promo_code text,
  has_inhouse_estate_attorney boolean DEFAULT false,
  inhouse_review_attorney_id uuid,
  platform_fee_amount integer DEFAULT 0,
  domain_verified boolean NOT NULL DEFAULT false,
  vault_tagline text,
  vault_theme text NOT NULL DEFAULT 'light'::text,
  vault_subdomain text,
  partner_revenue_pct numeric DEFAULT 0,
  theme_preset text NOT NULL DEFAULT 'cool'::text,
  hero_recipe text NOT NULL DEFAULT 'mesh'::text,
  highlight_dark text,
  highlight_light text,
  cta_text_override text,
  resend_domain_id text,
  sender_domain text,
  dns_records jsonb,
  email_verified boolean DEFAULT false,
  email_verified_at timestamp with time zone,
  last_verify_check_at timestamp with time zone,
  landing_text_color text DEFAULT '#1C3557'::text,
  hero_bg_override text,
  marketing_slug text
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  partner_id uuid,
  source text DEFAULT 'direct'::text,
  state text DEFAULT 'Michigan'::text,
  advisor_name text,
  advisor_firm text,
  advisor_share_consent boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  documents_executed boolean DEFAULT false,
  documents_executed_at timestamp with time zone,
  funding_checklist jsonb DEFAULT '{}'::jsonb,
  life_events_logged jsonb DEFAULT '[]'::jsonb,
  vault_subscription_status text DEFAULT 'none'::text,
  vault_subscription_expiry timestamp with time zone,
  vault_subscription_stripe_id text,
  kdf_salt bytea,
  kdf_params jsonb,
  wrapped_mk_pass bytea,
  wrapped_mk_recovery bytea,
  pubkey_x25519 bytea,
  pubkey_ed25519 bytea,
  enc_version smallint DEFAULT 1,
  crypto_setup_at timestamp with time zone,
  crypto_backfill_complete_at timestamp with time zone,
  vault_master_share_a bytea,
  vault_master_share_c_enc bytea,
  vault_wrapped_mk_shamir bytea,
  vault_shamir_version integer DEFAULT 1,
  vault_shamir_initialized_at timestamp with time zone,
  intake_snapshot jsonb,
  intake_snapshot_updated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  partner_id uuid,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation text,
  hard_stop_triggered boolean DEFAULT false,
  hard_stop_reason text,
  completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  answers_purged_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  partner_id uuid,
  quiz_session_id uuid,
  product_type text NOT NULL,
  status text DEFAULT 'pending'::text,
  amount_total integer NOT NULL,
  ev_cut integer NOT NULL,
  partner_cut integer,
  attorney_cut integer,
  stripe_payment_intent_id text,
  stripe_session_id text,
  attorney_review_requested boolean DEFAULT false,
  complexity_flag boolean DEFAULT false,
  complexity_flag_reason text,
  acknowledgment_signed boolean DEFAULT false,
  acknowledgment_signed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  order_type text DEFAULT 'standard'::text,
  expires_at timestamp with time zone,
  intake_data jsonb,
  amendment_type text,
  affiliate_id uuid,
  affiliate_cut integer DEFAULT 0,
  parent_order_id uuid,
  amendment_target text,
  amendment_fields jsonb,
  amendment_summary text
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  client_id uuid,
  document_type text NOT NULL,
  template_version text NOT NULL,
  status text DEFAULT 'pending'::text,
  storage_path text,
  generated_at timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  sealed boolean NOT NULL DEFAULT false,
  sealed_for_user_id uuid,
  attorney_sealed_path text,
  attorney_sealed_for uuid,
  version integer NOT NULL DEFAULT 1,
  parent_document_id uuid,
  superseded_by uuid,
  superseded_at timestamp with time zone,
  generation_error text,
  source_fingerprint text
);

CREATE TABLE IF NOT EXISTS public.attorney_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  attorney_id uuid,
  status text DEFAULT 'pending'::text,
  notes text,
  reviewed_at timestamp with time zone,
  sla_deadline timestamp with time zone,
  attorney_fee integer DEFAULT 30000,
  created_at timestamp with time zone DEFAULT now(),
  reviewer_type text DEFAULT 'inhouse_estatevault'::text,
  fee_destination text DEFAULT 'estatevault'::text,
  fee_amount integer DEFAULT 30000,
  fee_controlled_by uuid,
  partner_id uuid
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  partner_id uuid,
  reason text NOT NULL,
  status text DEFAULT 'pending'::text,
  referral_fee integer DEFAULT 7500,
  referral_fee_paid boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid,
  amount integer NOT NULL,
  status text DEFAULT 'pending'::text,
  stripe_transfer_id text,
  payout_date date,
  orders_included jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  partner_id uuid,
  note text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_partner_id uuid,
  child_partner_id uuid,
  child_commission_pct numeric NOT NULL,
  parent_commission_pct numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waitlist_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid,
  client_email text NOT NULL,
  invited_at timestamp with time zone DEFAULT now(),
  launched boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.professional_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  professional_type text,
  client_count text,
  referral_source text,
  bar_number text,
  practice_areas text,
  desired_review_fee text,
  status text DEFAULT 'new'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_prospects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sales_rep_id uuid,
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  professional_type text,
  source text,
  notes text,
  stage text DEFAULT 'prospect'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  next_action_at timestamp with time zone,
  last_contacted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.sales_prospect_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prospect_id uuid,
  sales_rep_id uuid,
  type text NOT NULL,
  body text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_partner_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid,
  sales_rep_id uuid,
  note text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_type text NOT NULL,
  asset_name text NOT NULL,
  platform text,
  storage_path text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_slug text,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'print'::text,
  storage_path text NOT NULL,
  mime_type text DEFAULT 'application/pdf'::text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_global boolean NOT NULL DEFAULT false,
  file_size_bytes integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  uploaded_by uuid,
  platform text
);

CREATE TABLE IF NOT EXISTS public.affiliates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  code text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  stripe_account_id text,
  stripe_onboarding_complete boolean DEFAULT false,
  status text DEFAULT 'pending_onboarding'::text,
  total_clicks integer DEFAULT 0,
  total_conversions integer DEFAULT 0,
  total_earned_cents integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL,
  ip_hash text,
  user_agent text,
  referrer text,
  landing_path text,
  converted boolean DEFAULT false,
  order_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  status text DEFAULT 'pending'::text,
  stripe_transfer_id text,
  orders_included jsonb,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vault_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  category text NOT NULL,
  label text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_encrypted boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  ciphertext bytea,
  nonce bytea,
  enc_version smallint,
  label_blind bytea,
  storage_path text,
  backfilled_at timestamp with time zone,
  auto_generated boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.vault_trustees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  trustee_name text NOT NULL,
  trustee_email text NOT NULL,
  trustee_relationship text,
  verified boolean DEFAULT false,
  access_granted boolean DEFAULT false,
  access_requested_at timestamp with time zone,
  access_granted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text,
  invite_token uuid,
  invite_sent_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  ciphertext bytea,
  nonce bytea,
  enc_version smallint,
  email_blind bytea,
  backfilled_at timestamp with time zone,
  trustee_phone text,
  phone_blind bytea,
  active boolean DEFAULT true,
  access_scope jsonb
);

CREATE TABLE IF NOT EXISTS public.item_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  owner_client_id uuid NOT NULL,
  recipient_user_id uuid NOT NULL,
  wrapped_dek bytea NOT NULL,
  sender_pubkey bytea NOT NULL,
  enc_version smallint NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.farewell_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  recipient_email text NOT NULL,
  storage_path text,
  file_size_mb numeric(8,2),
  duration_seconds integer,
  vault_farewell_status text NOT NULL DEFAULT 'locked'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  unlocked_at timestamp with time zone,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  ciphertext bytea,
  nonce bytea,
  enc_version smallint,
  recipient_blind bytea,
  storage_header bytea,
  backfilled_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.farewell_verification_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  trustee_id uuid,
  trustee_email text NOT NULL,
  certificate_storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  notes text,
  identity_check_id text,
  identity_verified boolean DEFAULT false,
  vault_unlock_approved boolean DEFAULT false,
  unlock_window_started_at timestamp with time zone,
  unlock_window_expires_at timestamp with time zone,
  owner_vetoed_at timestamp with time zone,
  owner_veto_token_hash text,
  trustee_access_token_hash text,
  share_c_hash text,
  access_expires_at timestamp with time zone,
  otp_email_attempts integer DEFAULT 0,
  otp_sms_attempts integer DEFAULT 0,
  otp_email_hash text,
  otp_email_expires_at timestamp with time zone,
  trustee_email_notified_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.trustee_access_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trustee_id uuid,
  client_id uuid,
  request_id uuid,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  ip inet,
  user_agent text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ── Primary keys / unique ───────────────────────────────────────────────────
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.partners ADD CONSTRAINT partners_pkey PRIMARY KEY (id);
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE public.quiz_sessions ADD CONSTRAINT quiz_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE public.documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id);
ALTER TABLE public.attorney_reviews ADD CONSTRAINT attorney_reviews_pkey PRIMARY KEY (id);
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.referrals ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);
ALTER TABLE public.payouts ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);
ALTER TABLE public.client_notes ADD CONSTRAINT client_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.partner_relationships ADD CONSTRAINT partner_relationships_pkey PRIMARY KEY (id);
ALTER TABLE public.waitlist_invites ADD CONSTRAINT waitlist_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.professional_leads ADD CONSTRAINT professional_leads_pkey PRIMARY KEY (id);
ALTER TABLE public.sales_prospects ADD CONSTRAINT sales_prospects_pkey PRIMARY KEY (id);
ALTER TABLE public.sales_prospect_activity ADD CONSTRAINT sales_prospect_activity_pkey PRIMARY KEY (id);
ALTER TABLE public.sales_partner_notes ADD CONSTRAINT sales_partner_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_assets ADD CONSTRAINT marketing_assets_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_materials ADD CONSTRAINT marketing_materials_pkey PRIMARY KEY (id);
ALTER TABLE public.affiliates ADD CONSTRAINT affiliates_pkey PRIMARY KEY (id);
ALTER TABLE public.affiliates ADD CONSTRAINT affiliates_code_key UNIQUE (code);
ALTER TABLE public.affiliate_clicks ADD CONSTRAINT affiliate_clicks_pkey PRIMARY KEY (id);
ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_pkey PRIMARY KEY (id);
ALTER TABLE public.vault_items ADD CONSTRAINT vault_items_pkey PRIMARY KEY (id);
ALTER TABLE public.vault_trustees ADD CONSTRAINT vault_trustees_pkey PRIMARY KEY (id);
ALTER TABLE public.vault_trustees ADD CONSTRAINT vault_trustees_invite_token_key UNIQUE (invite_token);
ALTER TABLE public.item_shares ADD CONSTRAINT item_shares_pkey PRIMARY KEY (id);
ALTER TABLE public.item_shares ADD CONSTRAINT item_shares_item_id_recipient_user_id_key UNIQUE (item_id, recipient_user_id);
ALTER TABLE public.farewell_messages ADD CONSTRAINT farewell_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.farewell_verification_requests ADD CONSTRAINT farewell_verification_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.trustee_access_audit ADD CONSTRAINT trustee_access_audit_pkey PRIMARY KEY (id);

-- ── Foreign keys ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_managed_by_admin_fkey FOREIGN KEY (managed_by_admin) REFERENCES profiles(id);
ALTER TABLE public.partners ADD CONSTRAINT partners_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.partners ADD CONSTRAINT partners_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE public.partners ADD CONSTRAINT partners_inhouse_review_attorney_id_fkey FOREIGN KEY (inhouse_review_attorney_id) REFERENCES profiles(id);
ALTER TABLE public.clients ADD CONSTRAINT clients_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD CONSTRAINT clients_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE public.quiz_sessions ADD CONSTRAINT quiz_sessions_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_sessions ADD CONSTRAINT quiz_sessions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD CONSTRAINT orders_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_quiz_session_id_fkey FOREIGN KEY (quiz_session_id) REFERENCES quiz_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD CONSTRAINT documents_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD CONSTRAINT documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD CONSTRAINT documents_parent_document_id_fkey FOREIGN KEY (parent_document_id) REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD CONSTRAINT documents_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD CONSTRAINT documents_sealed_for_user_id_fkey FOREIGN KEY (sealed_for_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD CONSTRAINT documents_attorney_sealed_for_fkey FOREIGN KEY (attorney_sealed_for) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.attorney_reviews ADD CONSTRAINT attorney_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.attorney_reviews ADD CONSTRAINT attorney_reviews_attorney_id_fkey FOREIGN KEY (attorney_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.attorney_reviews ADD CONSTRAINT attorney_reviews_fee_controlled_by_fkey FOREIGN KEY (fee_controlled_by) REFERENCES profiles(id);
ALTER TABLE public.attorney_reviews ADD CONSTRAINT attorney_reviews_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id);
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE public.payouts ADD CONSTRAINT payouts_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
ALTER TABLE public.client_notes ADD CONSTRAINT client_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_notes ADD CONSTRAINT client_notes_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
ALTER TABLE public.partner_relationships ADD CONSTRAINT partner_relationships_parent_partner_id_fkey FOREIGN KEY (parent_partner_id) REFERENCES partners(id) ON DELETE CASCADE;
ALTER TABLE public.partner_relationships ADD CONSTRAINT partner_relationships_child_partner_id_fkey FOREIGN KEY (child_partner_id) REFERENCES partners(id) ON DELETE CASCADE;
ALTER TABLE public.waitlist_invites ADD CONSTRAINT waitlist_invites_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
ALTER TABLE public.sales_prospects ADD CONSTRAINT sales_prospects_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.sales_prospect_activity ADD CONSTRAINT sales_prospect_activity_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES sales_prospects(id) ON DELETE CASCADE;
ALTER TABLE public.sales_prospect_activity ADD CONSTRAINT sales_prospect_activity_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.sales_partner_notes ADD CONSTRAINT sales_partner_notes_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE;
ALTER TABLE public.sales_partner_notes ADD CONSTRAINT sales_partner_notes_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_materials ADD CONSTRAINT marketing_materials_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.affiliates ADD CONSTRAINT affiliates_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.affiliate_clicks ADD CONSTRAINT affiliate_clicks_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE;
ALTER TABLE public.affiliate_clicks ADD CONSTRAINT affiliate_clicks_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE;
ALTER TABLE public.vault_items ADD CONSTRAINT vault_items_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.vault_trustees ADD CONSTRAINT vault_trustees_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.item_shares ADD CONSTRAINT item_shares_item_id_fkey FOREIGN KEY (item_id) REFERENCES vault_items(id) ON DELETE CASCADE;
ALTER TABLE public.item_shares ADD CONSTRAINT item_shares_owner_client_id_fkey FOREIGN KEY (owner_client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.item_shares ADD CONSTRAINT item_shares_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.farewell_messages ADD CONSTRAINT farewell_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.farewell_verification_requests ADD CONSTRAINT farewell_verification_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE public.farewell_verification_requests ADD CONSTRAINT farewell_verification_requests_trustee_id_fkey FOREIGN KEY (trustee_id) REFERENCES vault_trustees(id);
ALTER TABLE public.farewell_verification_requests ADD CONSTRAINT farewell_verification_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);
ALTER TABLE public.trustee_access_audit ADD CONSTRAINT trustee_access_audit_client_id_fkey FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.trustee_access_audit ADD CONSTRAINT trustee_access_audit_trustee_id_fkey FOREIGN KEY (trustee_id) REFERENCES vault_trustees(id) ON DELETE SET NULL;
ALTER TABLE public.trustee_access_audit ADD CONSTRAINT trustee_access_audit_request_id_fkey FOREIGN KEY (request_id) REFERENCES farewell_verification_requests(id) ON DELETE SET NULL;

-- ── Check constraints ───────────────────────────────────────────────────────
-- NOTE: documents_document_type_check here is the WIDENED version, matching
-- migration 20260916_000_trust_package_document_types.sql. Production's own
-- CHECK admits only the five original types; apply that migration to production
-- before the Trust Package fulfillment change reaches it, or every trust order
-- will fail at document insert.
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_type_check CHECK ((user_type = ANY (ARRAY['client'::text, 'partner'::text, 'sales_rep'::text, 'review_attorney'::text, 'admin'::text, 'affiliate'::text])));
ALTER TABLE public.partners ADD CONSTRAINT partners_tier_check CHECK ((tier = ANY (ARRAY['standard'::text, 'enterprise'::text, 'basic'::text])));
ALTER TABLE public.partners ADD CONSTRAINT partners_status_check CHECK ((status = ANY (ARRAY['onboarding'::text, 'active'::text, 'suspended'::text, 'cancelled'::text, 'pending_verification'::text, 'rejected'::text])));
ALTER TABLE public.partners ADD CONSTRAINT partners_theme_preset_check CHECK ((theme_preset = ANY (ARRAY['warm'::text, 'cool'::text, 'mono'::text, 'bold'::text, 'earth'::text])));
ALTER TABLE public.partners ADD CONSTRAINT partners_hero_recipe_check CHECK ((hero_recipe = ANY (ARRAY['mesh'::text, 'spotlight'::text, 'geometric'::text, 'twilight'::text])));
ALTER TABLE public.partners ADD CONSTRAINT partners_vault_theme_check CHECK ((vault_theme = ANY (ARRAY['light'::text, 'dark'::text])));
ALTER TABLE public.partners ADD CONSTRAINT partners_partner_revenue_pct_check CHECK (((partner_revenue_pct >= (0)::numeric) AND (partner_revenue_pct <= (100)::numeric)));
ALTER TABLE public.clients ADD CONSTRAINT clients_source_check CHECK ((source = ANY (ARRAY['direct'::text, 'partner'::text])));
ALTER TABLE public.clients ADD CONSTRAINT clients_crypto_bundle_consistent CHECK ((((kdf_salt IS NULL) AND (kdf_params IS NULL) AND (wrapped_mk_pass IS NULL) AND (wrapped_mk_recovery IS NULL) AND (pubkey_x25519 IS NULL) AND (pubkey_ed25519 IS NULL)) OR ((kdf_salt IS NOT NULL) AND (kdf_params IS NOT NULL) AND (wrapped_mk_pass IS NOT NULL) AND (wrapped_mk_recovery IS NOT NULL) AND (pubkey_x25519 IS NOT NULL) AND (pubkey_ed25519 IS NOT NULL))));
ALTER TABLE public.quiz_sessions ADD CONSTRAINT quiz_sessions_recommendation_check CHECK ((recommendation = ANY (ARRAY['will'::text, 'trust'::text, 'attorney_referral'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_product_type_check CHECK ((product_type = ANY (ARRAY['will'::text, 'trust'::text, 'attorney_review'::text, 'amendment'::text, 'vault_subscription'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'generating'::text, 'review'::text, 'under_review'::text, 'delivered'::text, 'refunded'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_amendment_type_check CHECK ((amendment_type = ANY (ARRAY['paid'::text, 'subscription_included'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_amendment_target_check CHECK ((amendment_target = ANY (ARRAY['will'::text, 'trust'::text, 'pour_over_will'::text, 'poa'::text, 'healthcare_directive'::text])));
ALTER TABLE public.documents ADD CONSTRAINT documents_document_type_check CHECK ((document_type = ANY (ARRAY['will'::text, 'poa'::text, 'healthcare_directive'::text, 'trust'::text, 'certification_of_trust'::text, 'assignment_personal_property_g1'::text, 'assignment_personal_property_g2'::text, 'pour_over_will'::text, 'trust_funding_instructions'::text])));
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'generating'::text, 'generated'::text, 'delivered'::text, 'review'::text, 'failed'::text, 'blocked'::text])));
ALTER TABLE public.attorney_reviews ADD CONSTRAINT attorney_reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_review'::text, 'approved'::text, 'approved_with_notes'::text, 'flagged'::text])));
ALTER TABLE public.attorney_reviews ADD CONSTRAINT attorney_reviews_reviewer_type_check CHECK ((reviewer_type = ANY (ARRAY['inhouse_estatevault'::text, 'inhouse_partner'::text, 'review_network'::text])));
ALTER TABLE public.attorney_reviews ADD CONSTRAINT attorney_reviews_fee_destination_check CHECK ((fee_destination = ANY (ARRAY['estatevault'::text, 'partner_admin'::text, 'attorney_stripe_connect'::text])));
ALTER TABLE public.referrals ADD CONSTRAINT referrals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'contacted'::text, 'converted'::text, 'closed'::text])));
ALTER TABLE public.payouts ADD CONSTRAINT payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text])));
ALTER TABLE public.sales_prospects ADD CONSTRAINT sales_prospects_stage_check CHECK ((stage = ANY (ARRAY['prospect'::text, 'contacted'::text, 'demo_shown'::text])));
ALTER TABLE public.sales_prospect_activity ADD CONSTRAINT sales_prospect_activity_type_check CHECK ((type = ANY (ARRAY['note'::text, 'call'::text, 'email'::text, 'meeting'::text, 'stage_change'::text])));
ALTER TABLE public.marketing_assets ADD CONSTRAINT marketing_assets_asset_type_check CHECK ((asset_type = ANY (ARRAY['email_template'::text, 'social_post'::text, 'print_flyer'::text, 'brochure'::text, 'presentation_slide'::text, 'one_pager'::text, 'script_card'::text])));
ALTER TABLE public.marketing_materials ADD CONSTRAINT marketing_materials_target_chk CHECK ((((is_global = true) AND (partner_slug IS NULL)) OR ((is_global = false) AND (partner_slug IS NOT NULL))));
ALTER TABLE public.affiliates ADD CONSTRAINT affiliates_status_check CHECK ((status = ANY (ARRAY['pending_onboarding'::text, 'active'::text, 'suspended'::text])));
ALTER TABLE public.affiliate_payouts ADD CONSTRAINT affiliate_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'reversed'::text])));
ALTER TABLE public.vault_items ADD CONSTRAINT vault_items_category_check CHECK ((category = ANY (ARRAY['estate_document'::text, 'insurance'::text, 'financial_account'::text, 'digital_account'::text, 'physical_location'::text, 'contact'::text, 'final_wishes'::text, 'business'::text])));
ALTER TABLE public.farewell_messages ADD CONSTRAINT farewell_messages_vault_farewell_status_check CHECK ((vault_farewell_status = ANY (ARRAY['locked'::text, 'pending_verification'::text, 'unlocked'::text, 'deleted'::text, 'replaced'::text, 'expired'::text])));
ALTER TABLE public.farewell_verification_requests ADD CONSTRAINT farewell_verification_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX affiliate_clicks_affiliate_id_idx ON public.affiliate_clicks USING btree (affiliate_id, created_at DESC);
CREATE INDEX affiliate_payouts_affiliate_id_idx ON public.affiliate_payouts USING btree (affiliate_id);
CREATE INDEX affiliates_code_idx ON public.affiliates USING btree (code);
CREATE UNIQUE INDEX affiliates_profile_id_unique ON public.affiliates USING btree (profile_id);
CREATE INDEX idx_attorney_reviews_order_id ON public.attorney_reviews USING btree (order_id);
CREATE INDEX idx_attorney_reviews_status ON public.attorney_reviews USING btree (status);
CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (action);
CREATE INDEX idx_audit_log_actor_id ON public.audit_log USING btree (actor_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log USING btree (created_at);
CREATE INDEX idx_client_notes_client_id ON public.client_notes USING btree (client_id);
CREATE INDEX idx_client_notes_partner_id ON public.client_notes USING btree (partner_id);
CREATE INDEX clients_pubkey_x25519_idx ON public.clients USING btree (pubkey_x25519) WHERE (pubkey_x25519 IS NOT NULL);
CREATE INDEX idx_clients_partner_id ON public.clients USING btree (partner_id);
CREATE INDEX idx_clients_profile_id ON public.clients USING btree (profile_id);
CREATE INDEX documents_order_status_idx ON public.documents USING btree (order_id, status);
CREATE INDEX idx_documents_client_id ON public.documents USING btree (client_id);
CREATE INDEX idx_documents_order_id ON public.documents USING btree (order_id);
CREATE INDEX idx_documents_superseded_by ON public.documents USING btree (superseded_by);
CREATE INDEX farewell_messages_recipient_blind_idx ON public.farewell_messages USING btree (client_id, recipient_blind);
CREATE INDEX idx_farewell_messages_client ON public.farewell_messages USING btree (client_id);
CREATE INDEX idx_farewell_messages_status ON public.farewell_messages USING btree (vault_farewell_status);
CREATE INDEX fvr_unlock_window_idx ON public.farewell_verification_requests USING btree (unlock_window_expires_at) WHERE ((vault_unlock_approved = true) AND (owner_vetoed_at IS NULL));
CREATE INDEX idx_farewell_verif_status ON public.farewell_verification_requests USING btree (status);
CREATE INDEX item_shares_owner_idx ON public.item_shares USING btree (owner_client_id);
CREATE INDEX item_shares_recipient_idx ON public.item_shares USING btree (recipient_user_id) WHERE (revoked_at IS NULL);
CREATE INDEX idx_marketing_materials_is_global ON public.marketing_materials USING btree (is_global);
CREATE INDEX idx_marketing_materials_partner_slug ON public.marketing_materials USING btree (partner_slug, sort_order);
CREATE UNIQUE INDEX uq_marketing_materials_target_path ON public.marketing_materials USING btree (COALESCE(partner_slug, '_global'::text), storage_path);
CREATE INDEX idx_orders_client_id ON public.orders USING btree (client_id);
CREATE INDEX idx_orders_parent_order ON public.orders USING btree (parent_order_id);
CREATE INDEX idx_orders_partner_id ON public.orders USING btree (partner_id);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX orders_affiliate_id_idx ON public.orders USING btree (affiliate_id);
CREATE INDEX idx_partners_custom_domain ON public.partners USING btree (custom_domain) WHERE (custom_domain IS NOT NULL);
CREATE INDEX idx_partners_marketing_slug ON public.partners USING btree (marketing_slug);
CREATE INDEX idx_partners_subdomain ON public.partners USING btree (subdomain) WHERE (subdomain IS NOT NULL);
CREATE UNIQUE INDEX partners_custom_domain_unique ON public.partners USING btree (custom_domain) WHERE (custom_domain IS NOT NULL);
CREATE UNIQUE INDEX partners_profile_id_unique ON public.partners USING btree (profile_id);
CREATE UNIQUE INDEX partners_slug_unique ON public.partners USING btree (partner_slug) WHERE (partner_slug IS NOT NULL);
CREATE UNIQUE INDEX partners_subdomain_unique ON public.partners USING btree (subdomain) WHERE (subdomain IS NOT NULL);
CREATE UNIQUE INDEX partners_vault_subdomain_unique ON public.partners USING btree (vault_subdomain) WHERE (vault_subdomain IS NOT NULL);
CREATE INDEX idx_payouts_partner_id ON public.payouts USING btree (partner_id);
CREATE INDEX idx_quiz_sessions_client_id ON public.quiz_sessions USING btree (client_id);
CREATE INDEX quiz_sessions_purge_idx ON public.quiz_sessions USING btree (answers_purged_at) WHERE (answers_purged_at IS NULL);
CREATE INDEX idx_sales_partner_notes_partner ON public.sales_partner_notes USING btree (partner_id);
CREATE INDEX idx_prospect_activity_prospect ON public.sales_prospect_activity USING btree (prospect_id, created_at DESC);
CREATE INDEX idx_sales_prospects_next_action ON public.sales_prospects USING btree (next_action_at);
CREATE INDEX idx_sales_prospects_rep_id ON public.sales_prospects USING btree (sales_rep_id);
CREATE INDEX idx_sales_prospects_stage ON public.sales_prospects USING btree (stage);
CREATE INDEX trustee_audit_client_idx ON public.trustee_access_audit USING btree (client_id, created_at DESC);
CREATE INDEX trustee_audit_trustee_idx ON public.trustee_access_audit USING btree (trustee_id, created_at DESC);
CREATE INDEX idx_vault_items_client_id ON public.vault_items USING btree (client_id);
CREATE INDEX vault_items_auto_generated_idx ON public.vault_items USING btree (client_id, auto_generated);
CREATE INDEX vault_items_label_blind_idx ON public.vault_items USING btree (client_id, label_blind);
CREATE INDEX idx_vault_trustees_client_id ON public.vault_trustees USING btree (client_id);
CREATE INDEX vault_trustees_email_blind_idx ON public.vault_trustees USING btree (client_id, email_blind);

-- ── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.affiliates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quiz_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sales_prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vault_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_marketing_materials_updated_at BEFORE UPDATE ON public.marketing_materials FOR EACH ROW EXECUTE FUNCTION set_marketing_materials_updated_at();
CREATE TRIGGER trg_partners_autoslug BEFORE INSERT OR UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION partners_autoslug();

-- The auth-schema trigger. WITHOUT THIS, signup creates an auth user but no
-- profile row, and every downstream lookup fails.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
