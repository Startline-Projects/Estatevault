-- Admin-managed marketing materials: globals, file metadata, audit fields.

ALTER TABLE marketing_materials
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS file_size_bytes int,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- partner_slug nullable when is_global=true.
ALTER TABLE marketing_materials ALTER COLUMN partner_slug DROP NOT NULL;

ALTER TABLE marketing_materials
  DROP CONSTRAINT IF EXISTS marketing_materials_target_chk;
ALTER TABLE marketing_materials
  ADD CONSTRAINT marketing_materials_target_chk
  CHECK ((is_global = true AND partner_slug IS NULL) OR (is_global = false AND partner_slug IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_marketing_materials_is_global ON marketing_materials(is_global);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_marketing_materials_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketing_materials_updated_at ON marketing_materials;
CREATE TRIGGER trg_marketing_materials_updated_at
  BEFORE UPDATE ON marketing_materials
  FOR EACH ROW EXECUTE FUNCTION set_marketing_materials_updated_at();

-- Slugify helper (idempotent).
CREATE OR REPLACE FUNCTION slugify_simple(input text)
RETURNS text AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$ LANGUAGE sql IMMUTABLE;

-- Backfill marketing_slug for any partner missing one.
UPDATE partners
  SET marketing_slug = slugify_simple(company_name)
  WHERE marketing_slug IS NULL AND company_name IS NOT NULL;

-- Auto-slug on partner insert/update if null.
CREATE OR REPLACE FUNCTION partners_autoslug()
RETURNS trigger AS $$
BEGIN
  IF NEW.marketing_slug IS NULL AND NEW.company_name IS NOT NULL THEN
    NEW.marketing_slug = slugify_simple(NEW.company_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partners_autoslug ON partners;
CREATE TRIGGER trg_partners_autoslug
  BEFORE INSERT OR UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION partners_autoslug();
