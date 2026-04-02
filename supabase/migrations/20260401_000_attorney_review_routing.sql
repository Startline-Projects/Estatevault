-- Attorney Review Routing — adds routing, fee destination, and in-house attorney support
-- This migration supports the full attorney review routing table:
--   Direct client → Mo (EstateVault in-house, W-2 payroll)
--   Non-attorney partner → Mo
--   Attorney partner without in-house estate attorney → Mo
--   Attorney partner WITH in-house estate attorney → partner's attorney

-- 1. Add in-house attorney flag to partners
ALTER TABLE partners ADD COLUMN IF NOT EXISTS has_inhouse_estate_attorney boolean DEFAULT false;

-- 2. Add routing columns to attorney_reviews
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attorney_reviews' AND column_name = 'reviewer_type') THEN
    ALTER TABLE attorney_reviews ADD COLUMN reviewer_type text DEFAULT 'inhouse_estatevault'
      CHECK (reviewer_type IN ('inhouse_estatevault', 'inhouse_partner', 'review_network'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attorney_reviews' AND column_name = 'fee_destination') THEN
    ALTER TABLE attorney_reviews ADD COLUMN fee_destination text DEFAULT 'estatevault'
      CHECK (fee_destination IN ('estatevault', 'partner_admin', 'attorney_stripe_connect'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attorney_reviews' AND column_name = 'fee_amount') THEN
    ALTER TABLE attorney_reviews ADD COLUMN fee_amount integer DEFAULT 30000;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attorney_reviews' AND column_name = 'fee_controlled_by') THEN
    ALTER TABLE attorney_reviews ADD COLUMN fee_controlled_by uuid REFERENCES profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attorney_reviews' AND column_name = 'partner_id') THEN
    ALTER TABLE attorney_reviews ADD COLUMN partner_id uuid REFERENCES partners(id);
  END IF;
END $$;

-- 3. Add payroll/managed fields to profiles for review attorneys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_payroll') THEN
    ALTER TABLE profiles ADD COLUMN is_payroll boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bar_number') THEN
    ALTER TABLE profiles ADD COLUMN bar_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bar_verified') THEN
    ALTER TABLE profiles ADD COLUMN bar_verified boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bar_verified_at') THEN
    ALTER TABLE profiles ADD COLUMN bar_verified_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'managed_by_admin') THEN
    ALTER TABLE profiles ADD COLUMN managed_by_admin uuid REFERENCES profiles(id);
  END IF;
END $$;

-- 4. Add inhouse_review_attorney_id to partners (links partner to their in-house reviewer)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'inhouse_review_attorney_id') THEN
    ALTER TABLE partners ADD COLUMN inhouse_review_attorney_id uuid REFERENCES profiles(id);
  END IF;
END $$;

-- 5. RLS: review attorneys can only see their own assigned reviews
ALTER TABLE attorney_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attorney_reviews_select_own ON attorney_reviews;
CREATE POLICY attorney_reviews_select_own ON attorney_reviews
  FOR SELECT USING (attorney_id = auth.uid());

DROP POLICY IF EXISTS attorney_reviews_update_own ON attorney_reviews;
CREATE POLICY attorney_reviews_update_own ON attorney_reviews
  FOR UPDATE USING (attorney_id = auth.uid());

-- Service role bypasses RLS automatically, so admin/webhook operations still work.

-- 6. Backfill existing attorney_reviews with default routing values
UPDATE attorney_reviews
SET reviewer_type = 'inhouse_estatevault',
    fee_destination = 'estatevault',
    fee_amount = COALESCE(attorney_fee, 30000)
WHERE reviewer_type IS NULL;
