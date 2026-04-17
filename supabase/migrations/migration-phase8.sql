-- ============================================================
-- Phase 8 Migration — Partner dashboard additions
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Client notes table
CREATE TABLE IF NOT EXISTS client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can manage own client notes"
  ON client_notes FOR ALL
  USING (partner_id = public.get_partner_id());

CREATE POLICY "Admins can manage all client notes"
  ON client_notes FOR ALL
  USING (public.get_user_type() = 'admin');

-- Add last_login_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes (client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_partner_id ON client_notes (partner_id);
