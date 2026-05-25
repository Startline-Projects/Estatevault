-- ============================================================
-- Option A (server-managed, recoverable encryption) — Phase 2
-- Per-user Data Encryption Key (DEK), wrapped by a single app-wide
-- Key Encryption Key (KEK) held in Supabase Vault.
--
-- Encryption moves server-side: API routes unwrap the user DEK via the
-- KEK, then encrypt/decrypt vault payloads with the existing libsodium
-- EV01/EVS1 format. Server can decrypt (NOT zero-knowledge) → enables
-- easy password reset with no data loss.
-- ============================================================

BEGIN;

-- 1. Per-user DEK, wrapped under the KEK (EV01 envelope, bytea).
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS wrapped_dek  bytea,
  ADD COLUMN IF NOT EXISTS dek_setup_at timestamptz;

-- 2. KEK custody — Supabase Vault.
--    The KEK is 32 raw bytes, stored base64 as Vault secret 'ev_kek_v1'.
--    Create it ONCE, out-of-band (kept OUT of version control):
--      select vault.create_secret(
--        encode(gen_random_bytes(32), 'base64'),
--        'ev_kek_v1',
--        'EstateVault Option A KEK v1'
--      );
--    Rotation: create 'ev_kek_v2', re-wrap all clients.wrapped_dek, cut over.

-- 3. Service-role-only accessor for the decrypted KEK.
--    SECURITY DEFINER so the (postgres-owned) function can read vault.*,
--    while anon/authenticated cannot. search_path pinned to '' for safety.
CREATE OR REPLACE FUNCTION public.app_get_kek(p_name text DEFAULT 'ev_kek_v1')
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.app_get_kek(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_kek(text) TO service_role;

COMMIT;
