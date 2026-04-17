-- ============================================================
-- Phase 6 Migration — Additional columns for client portal
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Add vault PIN hash to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vault_pin_hash text;

-- Add notification preferences to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"documents_delivered": true, "annual_review": true, "life_event_reminders": true}';

-- Add execution tracking to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS documents_executed boolean DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS documents_executed_at timestamptz;

-- Add funding checklist tracking to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS funding_checklist jsonb DEFAULT '{}';

-- Add life events history to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS life_events_logged jsonb DEFAULT '[]';
