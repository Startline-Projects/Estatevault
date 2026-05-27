-- Replace listUsers() bomb with targeted email lookup (H-01)
-- auth.users has a unique index on email, so this is a single-row indexed scan.

CREATE OR REPLACE FUNCTION public.find_auth_user_by_email(lookup_email TEXT)
RETURNS TABLE(id UUID, email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au.id, au.email::TEXT
  FROM auth.users au
  WHERE au.email = lookup_email
  LIMIT 1;
$$;

-- Only callable by service role (admin client)
REVOKE ALL ON FUNCTION public.find_auth_user_by_email(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_auth_user_by_email(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.find_auth_user_by_email(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.find_auth_user_by_email(TEXT) TO service_role;
