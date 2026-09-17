-- ============================================================================
-- Storage: 4 buckets + 13 object policies. Target: staging only.
-- Without these the smoke test fails at document upload/download.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('documents', 'documents', false, NULL, NULL),
  ('farewell-videos', 'farewell-videos', false, 524288000,
     ARRAY['video/mp4','video/quicktime','video/webm','application/pdf','image/jpeg','image/png','image/jpg']),
  ('logos', 'logos', true, NULL, NULL),
  ('marketing-materials', 'marketing-materials', true, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── documents bucket: owner-scoped, anon denied outright ────────────────────
CREATE POLICY documents_deny_anon ON storage.objects AS PERMISSIVE FOR ALL TO anon, authenticated
  USING ((bucket_id <> 'documents'::text)) WITH CHECK ((bucket_id <> 'documents'::text));
CREATE POLICY docs_select_own ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'vault'::text) AND ((storage.foldername(name))[2] IN ( SELECT (clients.id)::text AS id FROM clients WHERE (clients.profile_id = auth.uid())))));
CREATE POLICY docs_insert_own ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'vault'::text) AND ((storage.foldername(name))[2] IN ( SELECT (clients.id)::text AS id FROM clients WHERE (clients.profile_id = auth.uid())))));
CREATE POLICY docs_update_own ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'vault'::text) AND ((storage.foldername(name))[2] IN ( SELECT (clients.id)::text AS id FROM clients WHERE (clients.profile_id = auth.uid())))));
CREATE POLICY docs_delete_own ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'vault'::text) AND ((storage.foldername(name))[2] IN ( SELECT (clients.id)::text AS id FROM clients WHERE (clients.profile_id = auth.uid())))));

-- ── farewell-videos bucket ──────────────────────────────────────────────────
CREATE POLICY farewell_videos_deny_anon ON storage.objects AS PERMISSIVE FOR ALL TO anon, authenticated
  USING ((bucket_id <> 'farewell-videos'::text)) WITH CHECK ((bucket_id <> 'farewell-videos'::text));
CREATE POLICY videos_select_own ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'farewell-videos'::text) AND ((storage.foldername(name))[1] IN ( SELECT (clients.id)::text AS id FROM clients WHERE (clients.profile_id = auth.uid())))));
CREATE POLICY videos_insert_own ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'farewell-videos'::text) AND ((storage.foldername(name))[1] IN ( SELECT (clients.id)::text AS id FROM clients WHERE (clients.profile_id = auth.uid())))));
CREATE POLICY videos_update_own ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'farewell-videos'::text) AND ((storage.foldername(name))[1] IN ( SELECT (clients.id)::text AS id FROM clients WHERE (clients.profile_id = auth.uid())))));
CREATE POLICY videos_delete_own ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'farewell-videos'::text) AND ((storage.foldername(name))[1] IN ( SELECT (clients.id)::text AS id FROM clients WHERE (clients.profile_id = auth.uid())))));

-- ── logos bucket (public read) ──────────────────────────────────────────────
CREATE POLICY "Anyone can read logos" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'logos'::text));
CREATE POLICY "Partners can upload logos" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((bucket_id = 'logos'::text) AND (auth.role() = 'authenticated'::text)));
CREATE POLICY "Partners can update logos" ON storage.objects AS PERMISSIVE FOR UPDATE TO public
  USING (((bucket_id = 'logos'::text) AND (auth.role() = 'authenticated'::text)));
