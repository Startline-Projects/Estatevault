CREATE TABLE IF NOT EXISTS professional_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  professional_type text,
  client_count text,
  referral_source text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE professional_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and sales reps can read leads"
  ON professional_leads FOR SELECT
  USING (public.get_user_type() IN ('admin', 'sales_rep'));

CREATE POLICY "Anyone can insert leads"
  ON professional_leads FOR INSERT
  WITH CHECK (true);
