-- Add intake_data column to orders table
-- This stores the intake form answers directly on the order,
-- so document generation can find them without needing a quiz_session link.
-- Already applied to production on 2026-03-29.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS intake_data jsonb;
