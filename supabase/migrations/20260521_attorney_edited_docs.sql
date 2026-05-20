-- Attorney edit-and-upload flow.
-- Additive only. Safe to run on envs that already have documents data.
--
-- review_docx_*  → editable DOCX generated at doc-gen time, sealed to the
--                  assigned review attorney so they can download + edit in Word.
-- reviewed_*     → final PDF the attorney uploads after editing, sealed to the
--                  client. When present, the client download serves THIS instead
--                  of the originally generated PDF. If the attorney approves
--                  without uploading, these stay NULL and the original is served.

alter table documents add column if not exists review_docx_path text;
alter table documents add column if not exists review_docx_for uuid references profiles(id);

alter table documents add column if not exists reviewed_path text;
alter table documents add column if not exists reviewed_sealed boolean not null default false;
alter table documents add column if not exists reviewed_for_user_id uuid references profiles(id);
alter table documents add column if not exists reviewed_uploaded_at timestamptz;
alter table documents add column if not exists reviewed_by uuid references profiles(id);
