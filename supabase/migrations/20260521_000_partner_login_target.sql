-- ============================================================
-- PARTNER LOGIN TARGET
-- Lets a firm-scoped client resolve its partner's whitelabel host
-- at login time. RLS on `partners` only allows the partner itself,
-- admins, and creating sales reps to read rows — a client cannot.
-- That made the partner-scoped client lockout read null and block
-- every firm client on every host. This security-definer function
-- exposes ONLY the host fields (no stripe/fee/sender data) and only
-- for the partner the calling client actually belongs to.
-- ============================================================

create or replace function public.get_partner_login_target(p_partner_id uuid)
returns table (
  subdomain text,
  custom_domain text,
  vault_subdomain text,
  company_name text
) as $$
  select p.subdomain, p.custom_domain, p.vault_subdomain, p.company_name
  from public.partners p
  where p.id = p_partner_id
    and exists (
      select 1 from public.clients c
      where c.partner_id = p.id
        and c.profile_id = auth.uid()
    );
$$ language sql security definer stable;

revoke execute on function public.get_partner_login_target(uuid) from public, anon;
grant execute on function public.get_partner_login_target(uuid) to authenticated;
