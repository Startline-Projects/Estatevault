-- ============================================================
-- H-4 — Atomic trustee OTP attempt counter.
--
-- The verify route used read-then-write to bump otp_email_attempts, so
-- concurrent wrong guesses could all read the same low count and slip past the
-- cap. This function does the increment + cap check in one locked UPDATE and
-- returns the new count, or NULL when already at/over the cap.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.increment_otp_attempt(
  p_request_id uuid,
  p_max integer
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.farewell_verification_requests
  SET otp_email_attempts = COALESCE(otp_email_attempts, 0) + 1
  WHERE id = p_request_id
    AND COALESCE(otp_email_attempts, 0) < p_max
  RETURNING otp_email_attempts;
$$;

REVOKE ALL ON FUNCTION public.increment_otp_attempt(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_otp_attempt(uuid, integer) TO service_role;

COMMIT;
