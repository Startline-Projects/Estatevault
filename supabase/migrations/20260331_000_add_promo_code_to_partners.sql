-- Add promo_code column to partners table
ALTER TABLE partners ADD COLUMN IF NOT EXISTS promo_code text;
