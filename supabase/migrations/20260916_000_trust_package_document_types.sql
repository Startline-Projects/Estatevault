-- ============================================================
-- Migration: admit the Trust Package document types
-- Run this in Supabase SQL Editor
--
-- A Trust Package is seven documents for a single grantor and eight for a
-- joint trust. Four of those types were never permitted by
-- documents_document_type_check:
--
--   certification_of_trust
--   assignment_personal_property_g1
--   assignment_personal_property_g2   (joint trusts only — one per Grantor)
--   trust_funding_instructions
--
-- Their templates have existed and rendered correctly since the Trust Package
-- work, but the fulfillment path hardcoded four types, so nothing ever tried to
-- insert them and the CHECK was never hit. With the webhook now creating the
-- full set, the CHECK has to admit them or every trust order fails at insert.
--
-- Widening a CHECK never invalidates existing rows, so this is safe to run on a
-- populated database.
-- ============================================================

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE documents ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN (
    -- Will Package
    'will',
    'poa',
    'healthcare_directive',
    -- Trust Package
    'trust',
    'certification_of_trust',
    'assignment_personal_property_g1',
    'assignment_personal_property_g2',
    'pour_over_will',
    'trust_funding_instructions'
  ));

COMMENT ON CONSTRAINT documents_document_type_check ON documents IS
  'Document types the platform generates. Trust Package types were added 2026-09-16 when the fulfillment path began creating rows for the full package.';
