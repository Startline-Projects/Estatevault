-- Attorney partner features migration
ALTER TABLE partners ADD COLUMN IF NOT EXISTS custom_review_fee integer DEFAULT 30000;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS bar_number text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS practice_areas text[];

ALTER TABLE professional_leads ADD COLUMN IF NOT EXISTS bar_number text;
ALTER TABLE professional_leads ADD COLUMN IF NOT EXISTS practice_areas text[];
ALTER TABLE professional_leads ADD COLUMN IF NOT EXISTS desired_review_fee integer;
