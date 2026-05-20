-- Reminder dedup tracking for recurring client notifications.
-- Annual review + life-event check-in crons stamp these so a client
-- receives each reminder at most once per cycle.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_annual_review_sent_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_life_event_checkin_sent_at timestamptz;
