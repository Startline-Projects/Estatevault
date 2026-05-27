-- Stripe webhook idempotency guard (S-09)
-- Prevents duplicate processing of Stripe events on replay/retry

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON stripe_webhook_events (processed_at);

-- Optional: auto-cleanup events older than 30 days (run as cron or manual)
-- DELETE FROM stripe_webhook_events WHERE processed_at < now() - interval '30 days';
