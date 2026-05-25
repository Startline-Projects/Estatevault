-- ============================================================
-- Option A — Phase 5: WIPE pre-launch zero-knowledge data
--
-- ⚠️ DESTRUCTIVE. Deletes ALL vault content + stored files and resets each
-- client's zero-knowledge key bundle. Intended for PRE-LAUNCH only (no real
-- user data). Existing rows were encrypted under per-user Master Keys the
-- server cannot decrypt, so they cannot carry over to the server-managed
-- (Option A) model — they are removed and recreated fresh.
--
-- Do NOT run this once real users exist.
-- ============================================================

BEGIN;

-- 1. Vault content + dependents (delete children before parents).
DELETE FROM trustee_access_audit;
DELETE FROM farewell_verification_requests;
DELETE FROM item_shares;
DELETE FROM farewell_messages;
DELETE FROM vault_trustees;
DELETE FROM vault_items;

-- 2. Stored files (ciphertext blobs) — handled OUTSIDE this migration.
--    Direct DELETE FROM storage.objects is blocked by storage.protect_delete().
--    Run: npx tsx scripts/wipe-vault-storage.ts (removes blobs via Storage API).

-- 3. Reset per-client key material.
--    Null the entire zero-knowledge crypto bundle (all-null satisfies the
--    clients_crypto_bundle_consistent CHECK) plus Shamir + Option A DEK, so the
--    server lazily provisions a fresh DEK under the Vault KEK on next use.
UPDATE clients SET
  kdf_salt                    = NULL,
  kdf_params                  = NULL,
  wrapped_mk_pass             = NULL,
  wrapped_mk_recovery         = NULL,
  pubkey_x25519               = NULL,
  pubkey_ed25519              = NULL,
  crypto_setup_at             = NULL,
  crypto_backfill_complete_at = NULL,
  vault_master_share_a        = NULL,
  vault_master_share_c_enc    = NULL,
  vault_wrapped_mk_shamir     = NULL,
  vault_shamir_initialized_at = NULL,
  wrapped_dek                 = NULL,
  dek_setup_at                = NULL;

-- 4. Clear old 4-digit PIN hashes so users set a fresh 6-digit app-lock PIN.
UPDATE profiles SET vault_pin_hash = NULL WHERE vault_pin_hash IS NOT NULL;

COMMIT;
