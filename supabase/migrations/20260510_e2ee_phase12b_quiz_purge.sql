-- Phase 12b — Quiz answer plaintext lifetime minimization.
--
-- Quiz happens before signup; user has no MK at quiz time, so we can't encrypt
-- to their pubkey. Pragmatic mitigation: keep `answers` plaintext only as long
-- as needed to generate PDFs. After successful generation, purge answers and
-- timestamp the purge.
--
-- True E2EE for quiz answers would require a UX pivot (account first, quiz
-- second). Tracked separately.

BEGIN;

ALTER TABLE quiz_sessions
  ADD COLUMN IF NOT EXISTS answers_purged_at timestamptz;

COMMENT ON COLUMN quiz_sessions.answers
  IS 'Plaintext intake answers. Purged to ''{}'' after PDFs generated; see answers_purged_at.';
COMMENT ON COLUMN quiz_sessions.answers_purged_at
  IS 'When server purged plaintext answers after successful PDF generation.';

CREATE INDEX IF NOT EXISTS quiz_sessions_purge_idx
  ON quiz_sessions (answers_purged_at)
  WHERE answers_purged_at IS NULL;

COMMIT;
