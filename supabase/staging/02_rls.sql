-- ============================================================================
-- RLS: enable on all 29 tables, then 87 policies.
-- Extracted read-only from production on 2026-09-16. Target: staging only.
--
-- Without this file staging would be wide open and every security result from
-- the smoke test would be meaningless.
-- ============================================================================

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attorney_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farewell_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farewell_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_partner_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_prospect_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trustee_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_trustees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_invites ENABLE ROW LEVEL SECURITY;

-- ── profiles ────────────────────────────────────────────────────────────────
CREATE POLICY "Users can read own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((id = auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((id = auth.uid()));
CREATE POLICY "Admins can read all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((get_user_type() = 'admin'::text));

-- ── clients ─────────────────────────────────────────────────────────────────
CREATE POLICY "Clients can read own record" ON public.clients AS PERMISSIVE FOR SELECT TO public USING ((profile_id = auth.uid()));
CREATE POLICY "Clients can insert own record" ON public.clients AS PERMISSIVE FOR INSERT TO public WITH CHECK ((profile_id = auth.uid()));
CREATE POLICY "Clients can update own record" ON public.clients AS PERMISSIVE FOR UPDATE TO public USING ((profile_id = auth.uid()));
CREATE POLICY "Partners can read their clients" ON public.clients AS PERMISSIVE FOR SELECT TO public USING ((partner_id = get_partner_id()));
CREATE POLICY "Admins can read all clients" ON public.clients AS PERMISSIVE FOR SELECT TO public USING ((get_user_type() = 'admin'::text));

-- ── partners ────────────────────────────────────────────────────────────────
CREATE POLICY "Partners can read own record" ON public.partners AS PERMISSIVE FOR SELECT TO public USING ((profile_id = auth.uid()));
CREATE POLICY "Partners can update own record" ON public.partners AS PERMISSIVE FOR UPDATE TO public USING ((profile_id = auth.uid()));
CREATE POLICY "Admins can read all partners" ON public.partners AS PERMISSIVE FOR SELECT TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Admins can update all partners" ON public.partners AS PERMISSIVE FOR UPDATE TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Sales reps can insert partners" ON public.partners AS PERMISSIVE FOR INSERT TO public WITH CHECK ((get_user_type() = ANY (ARRAY['sales_rep'::text, 'admin'::text])));
CREATE POLICY "Sales reps can read partners they created" ON public.partners AS PERMISSIVE FOR SELECT TO public USING ((created_by = auth.uid()));
CREATE POLICY "Sales reps can read pending verification partners" ON public.partners AS PERMISSIVE FOR SELECT TO public USING (((get_user_type() = 'sales_rep'::text) AND (status = 'pending_verification'::text)));
CREATE POLICY "Sales reps can update pending verification partners" ON public.partners AS PERMISSIVE FOR UPDATE TO public USING (((get_user_type() = 'sales_rep'::text) AND (status = ANY (ARRAY['pending_verification'::text, 'rejected'::text])))) WITH CHECK ((get_user_type() = 'sales_rep'::text));

-- ── orders ──────────────────────────────────────────────────────────────────
CREATE POLICY "Clients can read own orders" ON public.orders AS PERMISSIVE FOR SELECT TO public USING ((client_id = get_client_id()));
CREATE POLICY "Partners can read their orders" ON public.orders AS PERMISSIVE FOR SELECT TO public USING ((partner_id = get_partner_id()));
CREATE POLICY "Admins can manage all orders" ON public.orders AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));

-- ── documents ───────────────────────────────────────────────────────────────
CREATE POLICY "Clients can read own documents" ON public.documents AS PERMISSIVE FOR SELECT TO public USING ((client_id = get_client_id()));
CREATE POLICY "Review attorneys can read documents under review" ON public.documents AS PERMISSIVE FOR SELECT TO public USING (((get_user_type() = 'review_attorney'::text) AND (status = 'under_review'::text)));
CREATE POLICY "Admins can manage all documents" ON public.documents AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));

-- ── quiz_sessions ───────────────────────────────────────────────────────────
CREATE POLICY "Clients can read own quiz sessions" ON public.quiz_sessions AS PERMISSIVE FOR SELECT TO public USING ((client_id = get_client_id()));
CREATE POLICY "Clients can insert quiz sessions" ON public.quiz_sessions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((client_id = get_client_id()));
CREATE POLICY "Clients can update own quiz sessions" ON public.quiz_sessions AS PERMISSIVE FOR UPDATE TO public USING ((client_id = get_client_id()));
CREATE POLICY "Partners can read their quiz sessions" ON public.quiz_sessions AS PERMISSIVE FOR SELECT TO public USING ((partner_id = get_partner_id()));
CREATE POLICY "Admins can read all quiz sessions" ON public.quiz_sessions AS PERMISSIVE FOR SELECT TO public USING ((get_user_type() = 'admin'::text));

-- ── attorney_reviews ────────────────────────────────────────────────────────
CREATE POLICY "Attorneys can read assigned reviews" ON public.attorney_reviews AS PERMISSIVE FOR SELECT TO public USING ((attorney_id = auth.uid()));
CREATE POLICY "Attorneys can update assigned reviews" ON public.attorney_reviews AS PERMISSIVE FOR UPDATE TO public USING ((attorney_id = auth.uid()));
CREATE POLICY attorney_reviews_select_own ON public.attorney_reviews AS PERMISSIVE FOR SELECT TO public USING ((attorney_id = auth.uid()));
CREATE POLICY attorney_reviews_update_own ON public.attorney_reviews AS PERMISSIVE FOR UPDATE TO public USING ((attorney_id = auth.uid()));
CREATE POLICY "Admins can manage all reviews" ON public.attorney_reviews AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));

-- ── app_settings ────────────────────────────────────────────────────────────
CREATE POLICY "Anyone can read app settings" ON public.app_settings AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert app settings" ON public.app_settings AS PERMISSIVE FOR INSERT TO public WITH CHECK ((get_user_type() = 'admin'::text));
CREATE POLICY "Admins can update app settings" ON public.app_settings AS PERMISSIVE FOR UPDATE TO public USING ((get_user_type() = 'admin'::text));

-- ── audit_log ───────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can insert audit entries" ON public.audit_log AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Admins can read all audit entries" ON public.audit_log AS PERMISSIVE FOR SELECT TO public USING ((get_user_type() = 'admin'::text));

-- ── referrals / payouts / notes / relationships / invites ───────────────────
CREATE POLICY "Partners can read their referrals" ON public.referrals AS PERMISSIVE FOR SELECT TO public USING ((partner_id = get_partner_id()));
CREATE POLICY "Admins can manage all referrals" ON public.referrals AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Partners can read own payouts" ON public.payouts AS PERMISSIVE FOR SELECT TO public USING ((partner_id = get_partner_id()));
CREATE POLICY "Admins can manage all payouts" ON public.payouts AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Partners can manage own client notes" ON public.client_notes AS PERMISSIVE FOR ALL TO public USING ((partner_id = get_partner_id()));
CREATE POLICY "Admins can manage all client notes" ON public.client_notes AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Partners can read own relationships" ON public.partner_relationships AS PERMISSIVE FOR SELECT TO public USING (((parent_partner_id = get_partner_id()) OR (child_partner_id = get_partner_id())));
CREATE POLICY "Admins can manage relationships" ON public.partner_relationships AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Partners can manage own invites" ON public.waitlist_invites AS PERMISSIVE FOR ALL TO public USING ((partner_id = get_partner_id()));
CREATE POLICY "Admins can manage all invites" ON public.waitlist_invites AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));

-- ── professional_leads ──────────────────────────────────────────────────────
CREATE POLICY "Anyone can insert leads" ON public.professional_leads AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins and sales reps can read leads" ON public.professional_leads AS PERMISSIVE FOR SELECT TO public USING ((get_user_type() = ANY (ARRAY['admin'::text, 'sales_rep'::text])));

-- ── sales ───────────────────────────────────────────────────────────────────
CREATE POLICY "Sales reps can manage own prospects" ON public.sales_prospects AS PERMISSIVE FOR ALL TO public USING ((sales_rep_id = auth.uid()));
CREATE POLICY "Admins can manage all prospects" ON public.sales_prospects AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Sales reps manage own prospect activity" ON public.sales_prospect_activity AS PERMISSIVE FOR ALL TO public USING ((sales_rep_id = auth.uid()));
CREATE POLICY "Admins manage all prospect activity" ON public.sales_prospect_activity AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Sales reps can manage own partner notes" ON public.sales_partner_notes AS PERMISSIVE FOR ALL TO public USING ((sales_rep_id = auth.uid()));
CREATE POLICY "Admins can manage all partner notes" ON public.sales_partner_notes AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));

-- ── marketing ───────────────────────────────────────────────────────────────
CREATE POLICY "Partners can read active marketing assets" ON public.marketing_assets AS PERMISSIVE FOR SELECT TO public USING (((is_active = true) AND (get_user_type() = ANY (ARRAY['partner'::text, 'admin'::text]))));
CREATE POLICY "Admins can manage marketing assets" ON public.marketing_assets AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "read marketing materials authenticated" ON public.marketing_materials AS PERMISSIVE FOR SELECT TO authenticated USING (true);

-- ── affiliates ──────────────────────────────────────────────────────────────
CREATE POLICY "Affiliates read own record" ON public.affiliates AS PERMISSIVE FOR SELECT TO public USING (((profile_id = auth.uid()) OR (get_user_type() = 'admin'::text)));
CREATE POLICY "Affiliates update own record" ON public.affiliates AS PERMISSIVE FOR UPDATE TO public USING ((profile_id = auth.uid()));
CREATE POLICY "Admins manage affiliates" ON public.affiliates AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Affiliates read own clicks" ON public.affiliate_clicks AS PERMISSIVE FOR SELECT TO public USING (((affiliate_id = get_affiliate_id()) OR (get_user_type() = 'admin'::text)));
CREATE POLICY "Admins manage affiliate_clicks" ON public.affiliate_clicks AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Affiliates read own payouts" ON public.affiliate_payouts AS PERMISSIVE FOR SELECT TO public USING (((affiliate_id = get_affiliate_id()) OR (get_user_type() = 'admin'::text)));
CREATE POLICY "Admins manage affiliate_payouts" ON public.affiliate_payouts AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));

-- ── vault_items ─────────────────────────────────────────────────────────────
CREATE POLICY "Clients can read own vault items" ON public.vault_items AS PERMISSIVE FOR SELECT TO public USING ((client_id = get_client_id()));
CREATE POLICY "Clients can insert own vault items" ON public.vault_items AS PERMISSIVE FOR INSERT TO public WITH CHECK ((client_id = get_client_id()));
CREATE POLICY "Clients can update own vault items" ON public.vault_items AS PERMISSIVE FOR UPDATE TO public USING ((client_id = get_client_id()));
CREATE POLICY "Clients can delete own vault items" ON public.vault_items AS PERMISSIVE FOR DELETE TO public USING ((client_id = get_client_id()));
CREATE POLICY "Admins can read all vault items" ON public.vault_items AS PERMISSIVE FOR SELECT TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY vault_items_select_own ON public.vault_items AS PERMISSIVE FOR SELECT TO authenticated USING ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.profile_id = auth.uid()))));
CREATE POLICY vault_items_insert_own ON public.vault_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.profile_id = auth.uid()))));
CREATE POLICY vault_items_update_own ON public.vault_items AS PERMISSIVE FOR UPDATE TO authenticated USING ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.profile_id = auth.uid())))) WITH CHECK ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.profile_id = auth.uid()))));
CREATE POLICY vault_items_delete_own ON public.vault_items AS PERMISSIVE FOR DELETE TO authenticated USING ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.profile_id = auth.uid()))));

-- ── vault_trustees / item_shares / trustee audit ────────────────────────────
CREATE POLICY "Clients can manage own trustees" ON public.vault_trustees AS PERMISSIVE FOR ALL TO public USING ((client_id = get_client_id()));
CREATE POLICY "Admins can read all trustees" ON public.vault_trustees AS PERMISSIVE FOR SELECT TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY shares_no_direct ON public.item_shares AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY trustee_audit_owner_read ON public.trustee_access_audit AS PERMISSIVE FOR SELECT TO public USING ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.profile_id = auth.uid()))));

-- ── farewell ────────────────────────────────────────────────────────────────
CREATE POLICY "Clients can read own farewell messages" ON public.farewell_messages AS PERMISSIVE FOR SELECT TO public USING ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.profile_id = auth.uid()))));
CREATE POLICY "Clients can insert own farewell messages" ON public.farewell_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.profile_id = auth.uid()))));
CREATE POLICY "Clients can update own farewell messages" ON public.farewell_messages AS PERMISSIVE FOR UPDATE TO public USING ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.profile_id = auth.uid()))));
CREATE POLICY "Clients can delete own farewell messages" ON public.farewell_messages AS PERMISSIVE FOR DELETE TO public USING ((client_id IN ( SELECT clients.id FROM clients WHERE (clients.profile_id = auth.uid()))));
CREATE POLICY "Admins can read all farewell messages" ON public.farewell_messages AS PERMISSIVE FOR SELECT TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Admins can update all farewell messages" ON public.farewell_messages AS PERMISSIVE FOR UPDATE TO public USING ((get_user_type() = 'admin'::text));
CREATE POLICY "Trustees can insert verification requests" ON public.farewell_verification_requests AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Trustees can read own verification requests" ON public.farewell_verification_requests AS PERMISSIVE FOR SELECT TO public USING ((trustee_email = ( SELECT profiles.email FROM profiles WHERE (profiles.id = auth.uid()))));
CREATE POLICY "Admins can manage all verification requests" ON public.farewell_verification_requests AS PERMISSIVE FOR ALL TO public USING ((get_user_type() = 'admin'::text));
