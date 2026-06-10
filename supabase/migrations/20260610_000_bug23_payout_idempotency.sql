-- ============================================================
-- BUG-23 — Per-side-effect idempotency for the document-checkout webhook
-- ============================================================
-- The Stripe webhook handler can legitimately re-run for one order (Stripe
-- redelivery on a prior failure, and the reconcile cron re-dispatching stuck
-- orders — see BUG-1/BUG-8). App-level "already done?" checks exist but are
-- check-then-act, so two near-simultaneous deliveries can both pass the check
-- and double-write. These DB constraints are the hard backstop: each money/
-- data side effect can be applied at most once, regardless of concurrency.
--
-- Order matters: dedup any rows that already violate the constraint (possible
-- from earlier replays / seeded test data) BEFORE creating the unique index,
-- keeping the earliest physical row (ctid) in each group.

-- ── documents: one row per (order, type) ───────────────────
delete from documents d
using documents keep
where d.order_id = keep.order_id
  and d.document_type = keep.document_type
  and d.ctid > keep.ctid;

create unique index if not exists documents_order_type_key
  on documents (order_id, document_type);

-- ── attorney_reviews: one review per order ─────────────────
delete from attorney_reviews a
using attorney_reviews keep
where a.order_id = keep.order_id
  and a.ctid > keep.ctid;

create unique index if not exists attorney_reviews_order_id_key
  on attorney_reviews (order_id);

-- ── payouts: one row per Stripe transfer ───────────────────
-- Pending payouts have no transfer id yet; only constrain sent ones.
delete from payouts p
using payouts keep
where p.stripe_transfer_id is not null
  and p.stripe_transfer_id = keep.stripe_transfer_id
  and p.ctid > keep.ctid;

create unique index if not exists payouts_stripe_transfer_id_key
  on payouts (stripe_transfer_id)
  where stripe_transfer_id is not null;

-- ── affiliate_payouts: one row per Stripe transfer ─────────
delete from affiliate_payouts ap
using affiliate_payouts keep
where ap.stripe_transfer_id is not null
  and ap.stripe_transfer_id = keep.stripe_transfer_id
  and ap.ctid > keep.ctid;

create unique index if not exists affiliate_payouts_stripe_transfer_id_key
  on affiliate_payouts (stripe_transfer_id)
  where stripe_transfer_id is not null;

-- ── affiliate_payouts: one webhook payout per order ────────
-- The irreversible affiliate stats counter is bumped once per per-order payout
-- created by the document-checkout webhook. We gate it on a dedicated, nullable
-- `order_id` column so only the webhook's single-order rows are constrained —
-- the manual batch-payout route (which writes a multi-order `orders_included`
-- array and never touches the counter) leaves `order_id` null and is unaffected.
alter table affiliate_payouts add column if not exists order_id uuid
  references orders(id) on delete set null;

-- Backfill existing single-order webhook rows so dedup + the index cover history.
update affiliate_payouts ap
  set order_id = (ap.orders_included->>0)::uuid
  where ap.order_id is null
    and ap.orders_included is not null
    and jsonb_typeof(ap.orders_included) = 'array'
    and jsonb_array_length(ap.orders_included) = 1
    -- Only backfill when the referenced order still exists; orphaned legacy/test
    -- rows keep order_id null (unconstrained) and don't trip the FK.
    and exists (select 1 from orders o where o.id = (ap.orders_included->>0)::uuid);

delete from affiliate_payouts ap
using affiliate_payouts keep
where ap.order_id is not null
  and ap.order_id = keep.order_id
  and ap.ctid > keep.ctid;

create unique index if not exists affiliate_payouts_order_id_key
  on affiliate_payouts (order_id)
  where order_id is not null;
