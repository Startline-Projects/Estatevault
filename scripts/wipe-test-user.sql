-- Wipe ALL data for a test user by email — vault subscription, vault data,
-- trustee state, farewell messages, orders, profile, auth user.
-- Run in Supabase SQL editor as service role.
-- Replace email on the v_email line below, then run.
--
-- ORDER OF OPERATIONS:
--   1. FIRST run:  npx tsx scripts/wipe-test-user-storage.ts <email>
--      (deletes Storage blobs via the Storage API — SQL cannot, the
--       storage.protect_delete() trigger blocks DELETE FROM storage.objects.
--       This SQL deletes the rows that hold the storage paths, so blobs must
--       go first or they become orphaned.)
--   2. THEN run:  npx tsx scripts/wipe-test-user-stripe.ts <email>
--      (cancels the live Stripe subscription. SQL cannot — external API.
--       MUST do this, or /api/subscription/sync looks Stripe up by email and
--       resurrects vault_subscription_status='active' on the recreated client,
--       so the vault subscribe banner never reappears.)
--   3. THEN run this SQL.

DO $$
DECLARE
  v_email text := lower('waleed50602@gmail.com');
  v_user_id uuid;
  v_client_ids uuid[];
  v_order_ids uuid[];
  v_orphan_objects int;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth user for %', v_email;
  END IF;

  SELECT COALESCE(array_agg(id), '{}') INTO v_client_ids
    FROM clients WHERE profile_id = v_user_id;

  SELECT COALESCE(array_agg(id), '{}') INTO v_order_ids
    FROM orders WHERE client_id = ANY(v_client_ids);

  -- ----------------------------------------------------------------
  -- Storage objects: handled by scripts/wipe-test-user-storage.ts
  -- (DELETE FROM storage.objects is blocked by storage.protect_delete()).
  -- Warn if Storage blobs for this user still exist — run the TS script first.
  -- ----------------------------------------------------------------
  SELECT count(*) INTO v_orphan_objects
    FROM storage.objects
    WHERE bucket_id IN ('documents', 'farewell-videos')
      AND (owner = v_user_id
        OR name = ANY (
          SELECT storage_path FROM vault_items
            WHERE client_id = ANY(v_client_ids) AND storage_path IS NOT NULL
          UNION
          SELECT storage_path FROM documents
            WHERE order_id = ANY(v_order_ids) AND storage_path IS NOT NULL
          UNION
          SELECT storage_path FROM farewell_messages
            WHERE client_id = ANY(v_client_ids) AND storage_path IS NOT NULL
          UNION
          SELECT certificate_storage_path FROM farewell_verification_requests
            WHERE client_id = ANY(v_client_ids) AND certificate_storage_path IS NOT NULL
        ));

  IF v_orphan_objects > 0 THEN
    RAISE WARNING 'Storage still has % object(s) for %. Run: npx tsx scripts/wipe-test-user-storage.ts %  (blobs will be orphaned otherwise)',
      v_orphan_objects, v_email, v_email;
  END IF;

  -- ----------------------------------------------------------------
  -- Vault data + trustee state
  -- ----------------------------------------------------------------
  DELETE FROM trustee_access_audit WHERE client_id = ANY(v_client_ids);
  -- Farewell verification requests reference vault_trustees(trustee_id) —
  -- delete them before trustees or the FK blocks the trustee DELETE.
  DELETE FROM farewell_verification_requests WHERE client_id = ANY(v_client_ids);
  DELETE FROM farewell_messages WHERE client_id = ANY(v_client_ids);
  DELETE FROM vault_trustees WHERE client_id = ANY(v_client_ids);
  DELETE FROM item_shares WHERE owner_client_id = ANY(v_client_ids) OR recipient_user_id = v_user_id;
  DELETE FROM vault_items WHERE client_id = ANY(v_client_ids);

  -- Orders / docs / reviews / payouts
  -- (vault_subscription orders live here; product_type = 'vault_subscription')
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
  -- (clients row carries vault_subscription_* + all vault crypto columns:
  --  wrapped_dek, dek_setup_at, vault_master_share_a/_c_enc,
  --  vault_wrapped_mk_shamir, vault_shamir_*. profiles carries vault_pin_hash.
  --  All removed when these rows are deleted.)
  DELETE FROM clients WHERE id = ANY(v_client_ids);
  DELETE FROM profiles WHERE id = v_user_id OR lower(email) = v_email;

  -- Auth user last
  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;

  RAISE NOTICE 'Wiped user % (id=%) clients=% orders=% (storage handled separately by wipe-test-user-storage.ts)',
    v_email, v_user_id,
    array_length(v_client_ids,1), array_length(v_order_ids,1);
END $$;
