-- ============================================================
-- Migration: blocked document generation
-- Run this in Supabase SQL Editor
--
-- When the deterministic template pipeline runs in strict mode
-- (PDF_RENDERER=react-pdf-strict) a document that cannot be rendered correctly
-- must hold the order rather than silently fall back to the legacy generator or
-- ship with blank clauses. Such a document is marked 'blocked' and the reason
-- is recorded so an administrator can see what the intake was missing.
--
-- 'blocked' differs from 'failed': failed means generation errored and can be
-- retried as-is; blocked means the intake is incomplete and a human has to act.
-- ============================================================

-- Human-readable reason a document could not be generated.
-- Null for every document that generated normally.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS generation_error text;

COMMENT ON COLUMN documents.generation_error IS
  'Why generation was blocked (e.g. missing required intake fields). Null when the document generated successfully.';

-- Fingerprint of the intake fields a document's content depends on, recorded at
-- generation. Compared against the current intake before delivery to catch a
-- document that has gone stale — today, a Pour-Over Will whose Section 3.3
-- lists trust beneficiaries that have since been edited.
--
-- It is an HMAC, not a plain digest: plaintext quiz answers are purged after
-- generation, and a guessable digest of a short name list would put back the
-- data that purge exists to remove.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_fingerprint text;

COMMENT ON COLUMN documents.source_fingerprint IS
  'HMAC of the intake fields this document''s content depends on. Compared against the current intake to detect a stale document. Null for documents with no intake coupling, and for documents generated before fingerprinting.';

-- Fulfillment is gated on there being zero blocked documents for an order, so
-- this lookup runs on every order completion.
CREATE INDEX IF NOT EXISTS documents_order_status_idx
  ON documents (order_id, status);

-- If a status CHECK constraint exists, widen it to admit 'blocked'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'documents' AND constraint_name = 'documents_status_check'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT documents_status_check;
    ALTER TABLE documents ADD CONSTRAINT documents_status_check
      CHECK (status IN ('pending','generating','generated','delivered','review','failed','blocked'));
  END IF;
END $$;
