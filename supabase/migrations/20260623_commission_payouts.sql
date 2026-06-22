-- Commission payout ledger.
--
-- Sales reps and review attorneys earn a commission on the platform fees of the
-- partners they recruit. The commission page previously FAKED a "Paid" status
-- (hardcoded by month index, or derived from whether the partner paid their
-- fee) — it never tracked whether the recipient was actually paid out.
--
-- This table is the record of those payouts. Commission is paid by hand
-- (off-platform: ACH / check / payroll); an admin records each payment here.
-- The commission UI reads this table for a TRUE paid/owed status.
--
-- One payout per recipient per month. Accessed only via the service-role admin
-- client, so RLS is enabled with no policies (locked to service role).

create table if not exists public.commission_payouts (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  period       text not null,                       -- 'YYYY-MM'
  amount_cents integer not null check (amount_cents >= 0),
  status       text not null default 'paid',
  method       text,                                -- 'ach' | 'check' | 'payroll' | 'other'
  note         text,
  created_by   uuid references public.profiles(id) on delete set null,
  paid_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- One payout per recipient per period — blocks double-pay; makes the mark-paid
-- insert idempotent (a second click conflicts instead of paying twice).
create unique index if not exists commission_payouts_recipient_period_key
  on public.commission_payouts (recipient_id, period);

-- Read path filters by recipient (recipient's own page) and by period (admin
-- overview for a month).
create index if not exists commission_payouts_recipient_idx
  on public.commission_payouts (recipient_id);
create index if not exists commission_payouts_period_idx
  on public.commission_payouts (period);

alter table public.commission_payouts enable row level security;
