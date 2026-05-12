-- Rollback for 20260509_e2ee_phase1.sql.
-- Run only if Phase 3 deploy must be reverted before any client data has
-- been encrypted (i.e. ciphertext columns still NULL across the board).

BEGIN;

DROP TABLE IF EXISTS item_shares;

-- Restore farewell-videos plaintext-era policies (mirror migration-farewell-storage.sql).
-- DROP existing first so rollback is idempotent even if forward migration was
-- partial / never ran (policies may still exist from the original setup).
DROP POLICY IF EXISTS farewell_videos_deny_anon ON storage.objects;
DROP POLICY IF EXISTS documents_deny_anon ON storage.objects;
DROP POLICY IF EXISTS "Clients can upload own farewell videos" ON storage.objects;
DROP POLICY IF EXISTS "Clients can read own farewell videos"   ON storage.objects;
DROP POLICY IF EXISTS "Clients can update own farewell videos" ON storage.objects;
DROP POLICY IF EXISTS "Clients can delete own farewell videos" ON storage.objects;

CREATE POLICY "Clients can upload own farewell videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'farewell-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Clients can read own farewell videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'farewell-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Clients can update own farewell videos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'farewell-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Clients can delete own farewell videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'farewell-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_crypto_bundle_consistent,
  DROP COLUMN IF EXISTS crypto_backfill_complete_at,
  DROP COLUMN IF EXISTS crypto_setup_at,
  DROP COLUMN IF EXISTS enc_version,
  DROP COLUMN IF EXISTS pubkey_ed25519,
  DROP COLUMN IF EXISTS pubkey_x25519,
  DROP COLUMN IF EXISTS wrapped_mk_recovery,
  DROP COLUMN IF EXISTS wrapped_mk_pass,
  DROP COLUMN IF EXISTS kdf_params,
  DROP COLUMN IF EXISTS kdf_salt;

ALTER TABLE vault_items
  DROP COLUMN IF EXISTS backfilled_at,
  DROP COLUMN IF EXISTS storage_path,
  DROP COLUMN IF EXISTS label_blind,
  DROP COLUMN IF EXISTS enc_version,
  DROP COLUMN IF EXISTS nonce,
  DROP COLUMN IF EXISTS ciphertext;

ALTER TABLE vault_trustees
  DROP COLUMN IF EXISTS backfilled_at,
  DROP COLUMN IF EXISTS email_blind,
  DROP COLUMN IF EXISTS enc_version,
  DROP COLUMN IF EXISTS nonce,
  DROP COLUMN IF EXISTS ciphertext;

ALTER TABLE farewell_messages
  DROP COLUMN IF EXISTS backfilled_at,
  DROP COLUMN IF EXISTS storage_header,
  DROP COLUMN IF EXISTS recipient_blind,
  DROP COLUMN IF EXISTS enc_version,
  DROP COLUMN IF EXISTS nonce,
  DROP COLUMN IF EXISTS ciphertext;

COMMIT;
