-- Add landing page text/icon color override per partner.
-- Defaults to existing brand navy. Used by /[partner-slug] landing page.

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS landing_text_color TEXT DEFAULT '#1C3557';
