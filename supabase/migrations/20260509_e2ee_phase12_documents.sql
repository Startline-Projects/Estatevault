-- Phase 12 — server-generated PDFs sealed to user pubkey.
-- documents.sealed flags whether storage object is crypto_box_seal output.
-- documents.sealed_for_user_id records the recipient identity (client by default;
-- attorney review adds a parallel sealed copy under a sibling path).

BEGIN;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS sealed                 boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sealed_for_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attorney_sealed_path   text,
  ADD COLUMN IF NOT EXISTS attorney_sealed_for    uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN documents.sealed
  IS 'true → storage object is crypto_box_seal output; client must decrypt via worker.';
COMMENT ON COLUMN documents.attorney_sealed_path
  IS 'Optional secondary sealed copy for the assigned review attorney.';

COMMIT;
