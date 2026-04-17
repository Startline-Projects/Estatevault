-- ============================================================
-- Migration: Partner Custom Domain Tracking
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add domain_verified flag to partners table
ALTER TABLE partners ADD COLUMN IF NOT EXISTS domain_verified boolean NOT NULL DEFAULT false;

-- Index for fast hostname lookups in middleware
CREATE INDEX IF NOT EXISTS idx_partners_subdomain ON partners (subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_custom_domain ON partners (custom_domain) WHERE custom_domain IS NOT NULL;

SELECT 'Partner domain migration complete' AS status;
