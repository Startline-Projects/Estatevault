-- Partner whitelabel color overrides (nullable = use auto-derived defaults).
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS highlight_dark text,
  ADD COLUMN IF NOT EXISTS highlight_light text,
  ADD COLUMN IF NOT EXISTS cta_text_override text;
