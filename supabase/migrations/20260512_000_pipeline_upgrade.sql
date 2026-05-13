-- Pipeline upgrade — activity log + next-action tracking for sales_prospects

ALTER TABLE sales_prospects ADD COLUMN IF NOT EXISTS next_action_at timestamptz;
ALTER TABLE sales_prospects ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE sales_prospects ADD COLUMN IF NOT EXISTS phone text;

CREATE TABLE IF NOT EXISTS sales_prospect_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES sales_prospects(id) ON DELETE CASCADE,
  sales_rep_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('note', 'call', 'email', 'meeting', 'stage_change')),
  body text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_prospect_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales reps manage own prospect activity" ON sales_prospect_activity;
CREATE POLICY "Sales reps manage own prospect activity"
  ON sales_prospect_activity FOR ALL
  USING (sales_rep_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage all prospect activity" ON sales_prospect_activity;
CREATE POLICY "Admins manage all prospect activity"
  ON sales_prospect_activity FOR ALL
  USING (public.get_user_type() = 'admin');

CREATE INDEX IF NOT EXISTS idx_prospect_activity_prospect ON sales_prospect_activity (prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_next_action ON sales_prospects (next_action_at);
