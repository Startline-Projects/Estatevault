-- Phase 1: Basic Partner Tier
-- Adds 'basic' tier (white-label vault only, $500 one-time)
-- New columns: vault_tagline, vault_theme, vault_subdomain

-- 1. Extend tier check constraint
ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_tier_check;
ALTER TABLE partners ADD CONSTRAINT partners_tier_check
  CHECK (tier IN ('standard', 'enterprise', 'basic'));

-- 2. New vault branding columns
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS vault_tagline text,
  ADD COLUMN IF NOT EXISTS vault_theme text NOT NULL DEFAULT 'light'
    CHECK (vault_theme IN ('light', 'dark')),
  ADD COLUMN IF NOT EXISTS vault_subdomain text;

-- 3. Unique index on vault_subdomain
CREATE UNIQUE INDEX IF NOT EXISTS partners_vault_subdomain_unique
  ON partners (vault_subdomain) WHERE vault_subdomain IS NOT NULL;

-- 4. RLS: existing partner policies already scope by auth.uid() = profile_id,
--    so basic partners automatically see only their own row.
--    No new policies needed — basic tier is just another partner row.
