-- Keep the original DOCX the attorney uploaded (before DOCX->PDF conversion).
-- Lets the attorney re-download + re-edit later and serves as an audit record.
-- Additive only.

alter table documents add column if not exists reviewed_src_path text;
