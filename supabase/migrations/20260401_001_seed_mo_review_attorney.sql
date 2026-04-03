-- Seed Mo Murshed as EstateVault's in-house review attorney (W-2 payroll).
-- Mo is NOT an independent contractor — he is on EstateVault payroll.
-- All $300 attorney review fees for his reviews are EstateVault employment revenue,
-- NOT fee-splitting. This distinction is critical for compliance.

-- First, find or create Mo's auth user and profile.
-- We use upsert on profiles to avoid duplicates.
-- NOTE: Mo's auth user must be created via admin API (done in application code).
-- This migration ensures his profile has the correct fields once his user exists.

-- Update Mo's profile if it exists by email
UPDATE profiles
SET user_type = 'review_attorney',
    is_payroll = true,
    bar_number = 'P-79739',
    bar_verified = true,
    bar_verified_at = now()
WHERE email = 'mmurshed@thepeoplesfirmpllc.com';

-- Set managed_by_admin to the admin user (ockmedk@gmail.com)
UPDATE profiles
SET managed_by_admin = (SELECT id FROM profiles WHERE email = 'ockmedk@gmail.com' LIMIT 1)
WHERE email = 'mmurshed@thepeoplesfirmpllc.com'
  AND (SELECT id FROM profiles WHERE email = 'ockmedk@gmail.com' LIMIT 1) IS NOT NULL;
