-- ============================================================
-- E2EE Phase 1 — schema + RLS lockdown
-- Adds ciphertext columns. Plaintext columns kept for backfill window.
-- After Phase 13 backfill drains, plaintext columns will be dropped in a
-- follow-up migration (NOT this one — keep dual-write window safe).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. CLIENTS — per-user crypto material
-- ------------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kdf_salt              bytea,
  ADD COLUMN IF NOT EXISTS kdf_params            jsonb,
  ADD COLUMN IF NOT EXISTS wrapped_mk_pass       bytea,
  ADD COLUMN IF NOT EXISTS wrapped_mk_recovery   bytea,
  ADD COLUMN IF NOT EXISTS pubkey_x25519         bytea,
  ADD COLUMN IF NOT EXISTS pubkey_ed25519        bytea,
  ADD COLUMN IF NOT EXISTS enc_version           smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS crypto_setup_at       timestamptz,
  ADD COLUMN IF NOT EXISTS crypto_backfill_complete_at timestamptz;

-- Sanity: enc bundle either fully present or fully absent.
ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_crypto_bundle_consistent;
ALTER TABLE clients
  ADD CONSTRAINT clients_crypto_bundle_consistent
  CHECK (
    (kdf_salt IS NULL AND kdf_params IS NULL AND wrapped_mk_pass IS NULL
       AND wrapped_mk_recovery IS NULL AND pubkey_x25519 IS NULL AND pubkey_ed25519 IS NULL)
    OR
    (kdf_salt IS NOT NULL AND kdf_params IS NOT NULL AND wrapped_mk_pass IS NOT NULL
       AND wrapped_mk_recovery IS NOT NULL AND pubkey_x25519 IS NOT NULL AND pubkey_ed25519 IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS clients_pubkey_x25519_idx ON clients (pubkey_x25519) WHERE pubkey_x25519 IS NOT NULL;

-- ------------------------------------------------------------
-- 2. VAULT_ITEMS — ciphertext + blind index
-- ------------------------------------------------------------
ALTER TABLE vault_items
  ADD COLUMN IF NOT EXISTS ciphertext     bytea,
  ADD COLUMN IF NOT EXISTS nonce          bytea,
  ADD COLUMN IF NOT EXISTS enc_version    smallint,
  ADD COLUMN IF NOT EXISTS label_blind    bytea,
  ADD COLUMN IF NOT EXISTS storage_path   text,
  ADD COLUMN IF NOT EXISTS backfilled_at  timestamptz;

CREATE INDEX IF NOT EXISTS vault_items_label_blind_idx ON vault_items (client_id, label_blind);

-- ------------------------------------------------------------
-- 3. VAULT_TRUSTEES — encrypt name/email/relationship
-- ------------------------------------------------------------
ALTER TABLE vault_trustees
  ADD COLUMN IF NOT EXISTS ciphertext   bytea,
  ADD COLUMN IF NOT EXISTS nonce        bytea,
  ADD COLUMN IF NOT EXISTS enc_version  smallint,
  ADD COLUMN IF NOT EXISTS email_blind  bytea,
  ADD COLUMN IF NOT EXISTS backfilled_at timestamptz;

CREATE INDEX IF NOT EXISTS vault_trustees_email_blind_idx ON vault_trustees (client_id, email_blind);

-- ------------------------------------------------------------
-- 4. FAREWELL_MESSAGES — encrypt title + recipient_email; storage stays opaque .bin
-- ------------------------------------------------------------
ALTER TABLE farewell_messages
  ADD COLUMN IF NOT EXISTS ciphertext         bytea,
  ADD COLUMN IF NOT EXISTS nonce              bytea,
  ADD COLUMN IF NOT EXISTS enc_version        smallint,
  ADD COLUMN IF NOT EXISTS recipient_blind    bytea,
  ADD COLUMN IF NOT EXISTS storage_header     bytea,  -- secretstream 24B header (kept separate for streaming reads)
  ADD COLUMN IF NOT EXISTS backfilled_at      timestamptz;

CREATE INDEX IF NOT EXISTS farewell_messages_recipient_blind_idx
  ON farewell_messages (client_id, recipient_blind);

-- ------------------------------------------------------------
-- 5. ITEM_SHARES — per-item DEK sealed to recipient pubkey
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_shares (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id            uuid NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
  owner_client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  recipient_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wrapped_dek        bytea NOT NULL,        -- crypto_box_seal output
  sender_pubkey      bytea NOT NULL,        -- owner X25519 pub at time of share
  enc_version        smallint NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  revoked_at         timestamptz,
  UNIQUE (item_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS item_shares_recipient_idx ON item_shares (recipient_user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS item_shares_owner_idx     ON item_shares (owner_client_id);

ALTER TABLE item_shares ENABLE ROW LEVEL SECURITY;

-- Direct anon/authenticated access blocked. All reads/writes go via API routes
-- using service-role admin client, which validates auth.uid() against owner/recipient.
DROP POLICY IF EXISTS shares_no_direct ON item_shares;
CREATE POLICY shares_no_direct ON item_shares FOR ALL USING (false) WITH CHECK (false);

-- ------------------------------------------------------------
-- 6. STORAGE — deny anon on documents + farewell-videos buckets
-- All reads/writes must go through signed URLs minted by API routes.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Clients can upload own farewell videos" ON storage.objects;
DROP POLICY IF EXISTS "Clients can read own farewell videos"   ON storage.objects;
DROP POLICY IF EXISTS "Clients can update own farewell videos" ON storage.objects;
DROP POLICY IF EXISTS "Clients can delete own farewell videos" ON storage.objects;

-- Replace with deny-all for non-service-role on these buckets.
-- Service role bypasses RLS automatically.
DROP POLICY IF EXISTS farewell_videos_deny_anon ON storage.objects;
CREATE POLICY farewell_videos_deny_anon ON storage.objects
  FOR ALL TO authenticated, anon
  USING  (bucket_id <> 'farewell-videos')
  WITH CHECK (bucket_id <> 'farewell-videos');

DROP POLICY IF EXISTS documents_deny_anon ON storage.objects;
CREATE POLICY documents_deny_anon ON storage.objects
  FOR ALL TO authenticated, anon
  USING  (bucket_id <> 'documents')
  WITH CHECK (bucket_id <> 'documents');

-- ------------------------------------------------------------
-- 7. AUDIT LOG — record crypto lifecycle events
-- ------------------------------------------------------------
-- Existing audit_log already exists; add convenience CHECK extension if needed.
-- (No-op here — service-role API routes log via existing table.)

-- ------------------------------------------------------------
-- 8. Soft-rename markers — mark plaintext columns as deprecated
-- (No DROP yet. Backfill must complete first.)
-- ------------------------------------------------------------
COMMENT ON COLUMN vault_items.label
  IS 'DEPRECATED — being migrated to ciphertext + label_blind. Drop after backfill drains.';
COMMENT ON COLUMN vault_items.data
  IS 'DEPRECATED — being migrated to ciphertext. Drop after backfill drains.';
COMMENT ON COLUMN vault_trustees.trustee_name
  IS 'DEPRECATED — being migrated to ciphertext.';
COMMENT ON COLUMN vault_trustees.trustee_email
  IS 'DEPRECATED — being migrated to ciphertext + email_blind.';
COMMENT ON COLUMN vault_trustees.trustee_relationship
  IS 'DEPRECATED — being migrated to ciphertext.';
COMMENT ON COLUMN farewell_messages.title
  IS 'DEPRECATED — being migrated to ciphertext.';
COMMENT ON COLUMN farewell_messages.recipient_email
  IS 'DEPRECATED — being migrated to ciphertext + recipient_blind.';

COMMIT;
