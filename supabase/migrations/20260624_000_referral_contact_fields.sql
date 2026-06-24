-- Capture the lead's contact details on a hard-stop attorney referral so the
-- partner can see WHO applied and the attorney/admin has someone to contact.
-- Nullable: the checkout-session backstop path may still create a referral
-- without contact (client never filled the intake handoff form).
alter table referrals
  add column if not exists client_name text,
  add column if not exists client_email text,
  add column if not exists client_phone text;
