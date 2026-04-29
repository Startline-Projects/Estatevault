ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_revenue_pct numeric DEFAULT 0 CHECK (partner_revenue_pct >= 0 AND partner_revenue_pct <= 100);
