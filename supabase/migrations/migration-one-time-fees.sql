-- ============================================================
-- Migration: Convert partner platform fees from annual to one-time
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add platform_fee_type column to indicate one-time payment
ALTER TABLE partners ADD COLUMN IF NOT EXISTS platform_fee_type text DEFAULT 'one_time';

-- 2. Set all existing partners to one-time fee type
UPDATE partners SET platform_fee_type = 'one_time' WHERE platform_fee_type IS NULL;

-- 3. For any partner that had annual_fee_paid = true, also mark one_time_fee_paid = true
--    This ensures the onboarding skip logic works for legacy partners
UPDATE partners SET one_time_fee_paid = true WHERE annual_fee_paid = true AND (one_time_fee_paid IS NULL OR one_time_fee_paid = false);

-- 4. Verify
SELECT id, company_name, tier, annual_fee_paid, one_time_fee_paid, platform_fee_type
FROM partners
ORDER BY created_at DESC
LIMIT 10;
