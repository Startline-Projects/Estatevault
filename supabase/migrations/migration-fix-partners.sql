-- ============================================================
-- Fix partners table: add missing columns + update constraints
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add missing columns from migration-attorneys.sql
ALTER TABLE partners ADD COLUMN IF NOT EXISTS custom_review_fee integer DEFAULT 30000;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS bar_number text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS practice_areas text[];

-- 2. Add professional_type column (used by attorney checkout flow)
ALTER TABLE partners ADD COLUMN IF NOT EXISTS professional_type text;

-- 3. Drop the old status constraint and add expanded one
ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_status_check;
ALTER TABLE partners ADD CONSTRAINT partners_status_check
  CHECK (status IN ('onboarding', 'active', 'suspended', 'cancelled', 'pending_verification', 'rejected'));

-- 4. Add professional_leads columns if migration wasn't run
ALTER TABLE professional_leads ADD COLUMN IF NOT EXISTS bar_number text;
ALTER TABLE professional_leads ADD COLUMN IF NOT EXISTS practice_areas text[];
ALTER TABLE professional_leads ADD COLUMN IF NOT EXISTS desired_review_fee integer;

-- 5. Verify the fix
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'partners' AND column_name IN ('bar_number', 'professional_type', 'custom_review_fee')
ORDER BY column_name;
