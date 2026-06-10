-- BUG-1: make webhook idempotency commit-after-success.
-- Previously a row was inserted on receipt and treated as "seen" before the
-- handler ran. A handler crash left the event marked done, so Stripe retries
-- were dropped as duplicates → paid-but-unfulfilled orders. We now track a
-- lifecycle status so only COMPLETED events short-circuit; processing/failed
-- events are allowed to re-run on retry.

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Existing rows predate this column and were only ever inserted post-success,
-- so they are effectively completed.
UPDATE stripe_webhook_events
  SET status = 'completed', completed_at = COALESCE(completed_at, processed_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON stripe_webhook_events (status);
