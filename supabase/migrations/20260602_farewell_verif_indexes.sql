-- ============================================================
-- L-7 — Indexes on farewell_verification_requests lookup columns.
-- trustee_id and client_id are used in .eq(...) scans but were unindexed.
-- ============================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_farewell_verif_trustee_id
  ON farewell_verification_requests (trustee_id);

CREATE INDEX IF NOT EXISTS idx_farewell_verif_client_id
  ON farewell_verification_requests (client_id);

COMMIT;
