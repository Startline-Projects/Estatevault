-- Wipe all data for a test user by email.
-- Run in Supabase SQL editor as service role.
-- Replace email on the v_email line below, then run.

DO $$
DECLARE
  v_email text := lower('test@example.com');
  v_user_id uuid;
  v_client_ids uuid[];
  v_order_ids uuid[];
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth user for %', v_email;
  END IF;

  SELECT COALESCE(array_agg(id), '{}') INTO v_client_ids
    FROM clients WHERE profile_id = v_user_id;

  SELECT COALESCE(array_agg(id), '{}') INTO v_order_ids
    FROM orders WHERE client_id = ANY(v_client_ids);

  -- Vault
  DELETE FROM trustee_access_audit WHERE client_id = ANY(v_client_ids);
  DELETE FROM vault_trustees WHERE client_id = ANY(v_client_ids);
  DELETE FROM item_shares WHERE owner_client_id = ANY(v_client_ids) OR recipient_user_id = v_user_id;
  DELETE FROM vault_items WHERE client_id = ANY(v_client_ids);

  -- Farewell
  DELETE FROM farewell_verification_requests WHERE client_id = ANY(v_client_ids);
  DELETE FROM farewell_messages WHERE client_id = ANY(v_client_ids);

  -- Orders / docs / reviews / payouts
  DELETE FROM attorney_reviews WHERE order_id = ANY(v_order_ids);
  DELETE FROM documents WHERE order_id = ANY(v_order_ids);
  -- payouts is partner-level (no order_id); skip
  -- affiliate_payouts aggregates orders; clear only if needed for tests

  DELETE FROM orders WHERE id = ANY(v_order_ids);

  -- Quiz / intake
  DELETE FROM quiz_sessions WHERE client_id = ANY(v_client_ids);

  -- Notes / leads / referrals
  DELETE FROM client_notes WHERE client_id = ANY(v_client_ids);
  DELETE FROM referrals WHERE client_id = ANY(v_client_ids);
  DELETE FROM affiliate_clicks WHERE order_id = ANY(v_order_ids);
  DELETE FROM professional_leads WHERE email = v_email;

  -- Audit / waitlist
  DELETE FROM audit_log
    WHERE resource_id = v_user_id
       OR resource_id = ANY(v_client_ids)
       OR resource_id = ANY(v_order_ids);
  DELETE FROM waitlist_invites WHERE lower(client_email) = v_email;

  -- Clients + profile
  DELETE FROM clients WHERE id = ANY(v_client_ids);
  DELETE FROM profiles WHERE id = v_user_id OR lower(email) = v_email;

  -- Auth user last
  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;

  RAISE NOTICE 'Wiped user % (id=%) clients=% orders=%',
    v_email, v_user_id, array_length(v_client_ids,1), array_length(v_order_ids,1);
END $$;
