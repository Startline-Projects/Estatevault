-- Partner white-label email via Resend domains
alter table partners add column if not exists resend_domain_id text;
alter table partners add column if not exists sender_domain text;
alter table partners add column if not exists dns_records jsonb;
alter table partners add column if not exists email_verified boolean default false;
alter table partners add column if not exists email_verified_at timestamptz;
alter table partners add column if not exists last_verify_check_at timestamptz;
