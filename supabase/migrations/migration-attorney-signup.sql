-- Attorney signup flow migration
ALTER TABLE partners ADD COLUMN IF NOT EXISTS one_time_fee_paid boolean DEFAULT false;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS one_time_fee_amount integer;

-- Add attorney_model to professional_leads for review network applications
ALTER TABLE professional_leads ADD COLUMN IF NOT EXISTS attorney_model text;
ALTER TABLE professional_leads ADD COLUMN IF NOT EXISTS available_hours text;
