-- ============================================================
-- C-2 — Bind the per-user DEK wrap to client identity (AAD).
--
-- The wrapped_dek is now encrypted with associated data = "dek:<client.id>",
-- so a wrapped blob copied onto another client's row fails the AEAD tag check
-- on unwrap (no more cross-tenant vault decryption via a column copy).
--
-- Existing blobs were wrapped with NO aad. getOrCreateUserDek() self-heals them
-- lazily: on read it tries aad first, falls back to legacy (no-aad), then
-- re-wraps with aad and persists. This column records which version a row's
-- wrapped_dek is in, for ops visibility into the remaining legacy backlog.
--   NULL / 0 = legacy (no aad)   1 = aad-bound to client id
-- ============================================================

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS dek_aad_version smallint;

COMMENT ON COLUMN clients.dek_aad_version IS
  'wrapped_dek AAD binding version: NULL/0 = legacy (no aad), 1 = bound to "dek:<client.id>"';

COMMIT;
