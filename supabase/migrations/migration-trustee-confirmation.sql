-- Add email confirmation flow to vault_trustees
ALTER TABLE vault_trustees
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS invite_token UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Existing trustees (if any) should be considered active
UPDATE vault_trustees SET status = 'active' WHERE status = 'pending' AND confirmed_at IS NULL AND invite_token IS NULL;
