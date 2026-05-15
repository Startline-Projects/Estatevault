-- Marketing materials catalog. Partner-scoped via marketing_slug.
-- Files live in Supabase Storage bucket `marketing-materials`, public read.

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS marketing_slug text;

CREATE INDEX IF NOT EXISTS idx_partners_marketing_slug ON partners(marketing_slug);

CREATE TABLE IF NOT EXISTS marketing_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_slug text NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'print',
  storage_path text NOT NULL,
  mime_type text DEFAULT 'application/pdf',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_materials_partner_slug
  ON marketing_materials(partner_slug, sort_order);

ALTER TABLE marketing_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read marketing materials authenticated" ON marketing_materials;
CREATE POLICY "read marketing materials authenticated"
  ON marketing_materials FOR SELECT
  TO authenticated
  USING (true);

-- Tag Northwood partner row (matches existing businessUrl check).
UPDATE partners
  SET marketing_slug = 'northwood'
  WHERE marketing_slug IS NULL
    AND lower(coalesce(business_url, '')) LIKE '%northwoodwealthadvisors%';

-- Seed Northwood materials.
INSERT INTO marketing_materials (partner_slug, title, description, category, storage_path, sort_order) VALUES
  ('northwood', 'Business Card',     'Branded business card design',                  'print',   'northwood/business-card.pdf',     10),
  ('northwood', 'Flyer',             'One-page client-facing flyer',                  'print',   'northwood/flyer.pdf',             20),
  ('northwood', 'Trifold Brochure',  'Trifold brochure for in-person handouts',       'print',   'northwood/trifold-brochure.pdf',  30),
  ('northwood', 'Facebook Posts',    'Pre-made Facebook post graphics',               'social',  'northwood/facebook-posts.pdf',    40),
  ('northwood', 'Instagram Posts',   'Pre-made Instagram post graphics',              'social',  'northwood/instagram-posts.pdf',   50),
  ('northwood', 'LinkedIn Posts',    'Pre-made LinkedIn post graphics',               'social',  'northwood/linkedin-posts.pdf',    60)
ON CONFLICT DO NOTHING;

-- Storage bucket bootstrap (run once via dashboard if not present):
--   1) Create public bucket `marketing-materials`.
--   2) Upload PDFs under `northwood/` matching storage_path values above.
