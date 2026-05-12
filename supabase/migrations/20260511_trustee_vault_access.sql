-- ============================================================
-- Migration: Trustee Full-Vault Access — Shamir 2-of-3
-- Phase 1: schema for split-key emergency vault access.
--
-- Design:
--   Share A = stored on server (this DB, Supabase Vault ref)
--   Share B = derived from owner mnemonic (no DB storage)
--   Share C = generated at admin approval, emailed to trustee
-- ============================================================

-- ---------- Owner-side: wrapped MK + server shares (on clients) ----------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS vault_master_share_a bytea,
  ADD COLUMN IF NOT EXISTS vault_master_share_c_enc bytea,   -- Share C encrypted under TRUSTEE_RELEASE_KEY
  ADD COLUMN IF NOT EXISTS vault_wrapped_mk_shamir bytea,    -- MK wrapped under shamir master_key
  ADD COLUMN IF NOT EXISTS vault_shamir_version int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vault_shamir_initialized_at timestamptz;

COMMENT ON COLUMN clients.vault_master_share_a
  IS 'Shamir share A (plain). Any 2 of {A,B,C} reconstruct shamir master_key.';
COMMENT ON COLUMN clients.vault_master_share_c_enc
  IS 'Shamir share C encrypted under TRUSTEE_RELEASE_KEY env. Released to trustee at admin approval.';
COMMENT ON COLUMN clients.vault_wrapped_mk_shamir
  IS 'Owner MK wrapped under shamir master_key (XChaCha20-Poly1305 envelope).';

-- ---------- Trustee row additions ----------
ALTER TABLE vault_trustees
  ADD COLUMN IF NOT EXISTS trustee_phone text,
  ADD COLUMN IF NOT EXISTS phone_blind bytea,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- ---------- Verification request additions ----------
ALTER TABLE farewell_verification_requests
  ADD COLUMN IF NOT EXISTS identity_check_id text,
  ADD COLUMN IF NOT EXISTS identity_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vault_unlock_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlock_window_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlock_window_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_vetoed_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_veto_token_hash text,
  ADD COLUMN IF NOT EXISTS trustee_access_token_hash text,
  ADD COLUMN IF NOT EXISTS share_c_hash text,
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS otp_email_attempts int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_sms_attempts int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_email_hash text,
  ADD COLUMN IF NOT EXISTS otp_email_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS trustee_email_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS fvr_unlock_window_idx
  ON farewell_verification_requests (unlock_window_expires_at)
  WHERE vault_unlock_approved = true AND owner_vetoed_at IS NULL;

-- ---------- Trustee access audit ----------
CREATE TABLE IF NOT EXISTS trustee_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trustee_id uuid REFERENCES vault_trustees(id) ON DELETE SET NULL,
  client_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  request_id uuid REFERENCES farewell_verification_requests(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  ip inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trustee_audit_trustee_idx ON trustee_access_audit (trustee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trustee_audit_client_idx ON trustee_access_audit (client_id, created_at DESC);

ALTER TABLE trustee_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY trustee_audit_owner_read ON trustee_access_audit
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())
  );

-- Service role bypasses RLS for inserts from trustee unlock routes.

SELECT 'Trustee vault access phase 1 schema applied' AS status;
