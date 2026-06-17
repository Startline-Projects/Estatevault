-- ============================================================
-- Partner payout idempotency — one payout row per order (BUG-15 follow-up)
-- ============================================================
-- `payouts` only had a unique index on stripe_transfer_id, which is null for
-- 'pending' IOUs. So two near-simultaneous checkout-webhook deliveries could
-- both pass the app-level "already paid out?" check and each insert a 'pending'
-- payout for the SAME order — double-recording the partner cut and, once the
-- pending retry runs, risking a double Stripe transfer.
--
-- Mirror the affiliate fix (BUG-23): a dedicated single-order column with a
-- partial unique index is the hard backstop. Dedup pre-existing duplicates
-- before creating the index.

-- ── 1. Single-order column ─────────────────────────────────
alter table payouts add column if not exists order_id uuid
  references orders(id) on delete set null;

-- ── 2. Backfill single-order rows from orders_included[0] ──
-- Multi-order rows (none today) keep order_id null and stay unconstrained.
update payouts p
  set order_id = (p.orders_included->>0)::uuid
  where p.order_id is null
    and p.orders_included is not null
    and jsonb_typeof(p.orders_included) = 'array'
    and jsonb_array_length(p.orders_included) = 1
    and exists (select 1 from orders o where o.id = (p.orders_included->>0)::uuid);

-- ── 3. Dedupe: one row per order ───────────────────────────
-- Keep the most-resolved row per order: a 'sent' row (non-null transfer id)
-- wins over a 'pending' IOU; ties broken by earliest created. Safe for the
-- current data (all duplicates are 'pending' with null stripe_transfer_id, so
-- never transferred — deleting the extra drops no money record).
with ranked as (
  select id,
         row_number() over (
           partition by order_id
           order by (stripe_transfer_id is not null) desc, created_at asc, ctid asc
         ) as rn
  from payouts
  where order_id is not null
)
delete from payouts
where id in (select id from ranked where rn > 1);

-- ── 4. Enforce one payout per order going forward ──────────
create unique index if not exists payouts_order_id_key
  on payouts (order_id)
  where order_id is not null;
