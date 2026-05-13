-- Per-trustee access scope. Owner picks which categories + asset types a trustee
-- can see after emergency unlock. NULL = legacy full access (backward compat).
ALTER TABLE vault_trustees
  ADD COLUMN IF NOT EXISTS access_scope jsonb;

COMMENT ON COLUMN vault_trustees.access_scope IS
  'Shape: {"categories": string[], "documents": bool, "farewell": bool}. NULL = full access (legacy).';
