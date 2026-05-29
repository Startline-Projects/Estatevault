-- ============================================================
-- Combined unapplied migrations for production
-- Run this in Supabase Dashboard → SQL Editor
-- All statements use IF NOT EXISTS / OR REPLACE — safe to re-run
-- ============================================================

-- 1. Reminder tracking (20260520)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_annual_review_sent_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_life_event_checkin_sent_at timestamptz;

-- 2. Attorney edited docs (20260521)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_docx_path text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_docx_for uuid REFERENCES profiles(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_path text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_sealed boolean NOT NULL DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_for_user_id uuid REFERENCES profiles(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_uploaded_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_src_path text;

-- 3. Option A DEK (20260524)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wrapped_dek bytea;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS dek_setup_at timestamptz;

CREATE OR REPLACE FUNCTION public.app_get_kek(p_name text DEFAULT 'ev_kek_v1')
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.app_get_kek(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_kek(text) TO service_role;

-- 4. find_auth_user_by_email RPC (20260527)
CREATE OR REPLACE FUNCTION public.find_auth_user_by_email(lookup_email TEXT)
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au.id, au.email::TEXT
  FROM auth.users au
  WHERE au.email = lookup_email
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_auth_user_by_email(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_auth_user_by_email(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.find_auth_user_by_email(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.find_auth_user_by_email(TEXT) TO service_role;

-- 5. Stripe webhook idempotency (20260527)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON stripe_webhook_events (processed_at);
