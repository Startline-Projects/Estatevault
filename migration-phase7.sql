-- ============================================================
-- Phase 7 Migration — Partner portal additions
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Add partner slug and MFA columns
ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_slug text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS certification_completed boolean DEFAULT false;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS certification_completed_at timestamptz;

-- Create unique index on partner_slug
CREATE UNIQUE INDEX IF NOT EXISTS partners_slug_unique ON partners (partner_slug) WHERE partner_slug IS NOT NULL;

-- Create waitlist_invites table
CREATE TABLE IF NOT EXISTS waitlist_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  client_email text NOT NULL,
  invited_at timestamptz DEFAULT now(),
  launched boolean DEFAULT false
);

-- RLS for waitlist_invites
ALTER TABLE waitlist_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can manage own invites"
  ON waitlist_invites FOR ALL
  USING (partner_id = public.get_partner_id());

CREATE POLICY "Admins can manage all invites"
  ON waitlist_invites FOR ALL
  USING (public.get_user_type() = 'admin');
