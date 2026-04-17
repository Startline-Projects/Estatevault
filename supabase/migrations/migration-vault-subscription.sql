-- ============================================================
-- Migration: Vault Subscription + Farewell Messages
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add subscription columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vault_subscription_status text NOT NULL DEFAULT 'none'
  CHECK (vault_subscription_status IN ('none', 'active', 'past_due', 'cancelled'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vault_subscription_expiry timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vault_subscription_stripe_id text;

-- 2. Add amendment_type to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amendment_type text
  CHECK (amendment_type IN ('paid', 'subscription_included'));

-- 3. Create farewell_messages table
CREATE TABLE IF NOT EXISTS farewell_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  recipient_email text NOT NULL,
  storage_path text,
  file_size_mb numeric(8,2),
  duration_seconds integer,
  vault_farewell_status text NOT NULL DEFAULT 'locked'
    CHECK (vault_farewell_status IN ('locked', 'pending_verification', 'unlocked', 'deleted', 'replaced', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  unlocked_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_farewell_messages_client ON farewell_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_farewell_messages_status ON farewell_messages(vault_farewell_status);

-- 4. Create farewell_verification_requests table
CREATE TABLE IF NOT EXISTS farewell_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  trustee_id uuid REFERENCES vault_trustees(id),
  trustee_email text NOT NULL,
  certificate_storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_farewell_verif_status ON farewell_verification_requests(status);

-- 5. Enable RLS
ALTER TABLE farewell_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE farewell_verification_requests ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for farewell_messages
CREATE POLICY "Clients can read own farewell messages"
  ON farewell_messages FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

CREATE POLICY "Clients can insert own farewell messages"
  ON farewell_messages FOR INSERT
  WITH CHECK (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

CREATE POLICY "Clients can update own farewell messages"
  ON farewell_messages FOR UPDATE
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

CREATE POLICY "Clients can delete own farewell messages"
  ON farewell_messages FOR DELETE
  USING (client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid()));

CREATE POLICY "Admins can read all farewell messages"
  ON farewell_messages FOR SELECT
  USING (public.get_user_type() = 'admin');

CREATE POLICY "Admins can update all farewell messages"
  ON farewell_messages FOR UPDATE
  USING (public.get_user_type() = 'admin');

-- 7. RLS policies for farewell_verification_requests
CREATE POLICY "Admins can manage all verification requests"
  ON farewell_verification_requests FOR ALL
  USING (public.get_user_type() = 'admin');

CREATE POLICY "Trustees can insert verification requests"
  ON farewell_verification_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Trustees can read own verification requests"
  ON farewell_verification_requests FOR SELECT
  USING (trustee_email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- 8. Storage bucket for farewell videos (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('farewell-videos', 'farewell-videos', false);

-- 9. Verify
SELECT 'Migration complete' AS status;
