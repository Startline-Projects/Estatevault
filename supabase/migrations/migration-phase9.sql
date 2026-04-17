-- ============================================================
-- Phase 9 Migration — Sales rep portal additions
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Sales prospects table (pipeline)
CREATE TABLE IF NOT EXISTS sales_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_rep_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  professional_type text,
  source text,
  notes text,
  stage text DEFAULT 'prospect'
    CHECK (stage IN ('prospect', 'contacted', 'demo_shown')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sales_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales reps can manage own prospects"
  ON sales_prospects FOR ALL
  USING (sales_rep_id = auth.uid());

CREATE POLICY "Admins can manage all prospects"
  ON sales_prospects FOR ALL
  USING (public.get_user_type() = 'admin');

-- Sales partner notes table
CREATE TABLE IF NOT EXISTS sales_partner_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  sales_rep_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_partner_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales reps can manage own partner notes"
  ON sales_partner_notes FOR ALL
  USING (sales_rep_id = auth.uid());

CREATE POLICY "Admins can manage all partner notes"
  ON sales_partner_notes FOR ALL
  USING (public.get_user_type() = 'admin');

-- Add commission rate to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate decimal DEFAULT 0.05;

-- Add sales fields to partners
ALTER TABLE partners ADD COLUMN IF NOT EXISTS created_by_notes text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS prospect_source text;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_prospects_rep_id ON sales_prospects (sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_stage ON sales_prospects (stage);
CREATE INDEX IF NOT EXISTS idx_sales_partner_notes_partner ON sales_partner_notes (partner_id);

-- Updated_at trigger for sales_prospects
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sales_prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
