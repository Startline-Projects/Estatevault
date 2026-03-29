-- ============================================================
-- Migration: Test promo code settings
-- Run this in Supabase SQL Editor
-- ============================================================

-- App settings table for admin-controlled toggles
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

-- Insert default: test code active
INSERT INTO app_settings (key, value)
VALUES ('test_promo_code', '{"active": true}')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update app settings"
  ON app_settings FOR UPDATE
  USING (public.get_user_type() = 'admin');

CREATE POLICY "Admins can insert app settings"
  ON app_settings FOR INSERT
  WITH CHECK (public.get_user_type() = 'admin');
