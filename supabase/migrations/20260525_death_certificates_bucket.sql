-- ============================================================
-- Separate bucket for death certificates (PDF / image).
-- Kept OUT of the farewell-videos bucket so that bucket can stay
-- encrypted-only (application/octet-stream). Mime restrictions in
-- Supabase Storage apply per-bucket, not per-folder, so a shared
-- bucket cannot allow both opaque ciphertext and plaintext PDFs cleanly.
--
-- Access model: upload (POST /api/farewell/verify) and read
-- (GET /api/admin/farewell-verification, signed URL) both run through the
-- service-role admin client. storage.objects has RLS enabled and no
-- anon/authenticated policy is created for this bucket → deny-by-default;
-- only the service role can read/write. Mirrors farewell-videos.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'death-certificates',
  'death-certificates',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Certificates now live in their own bucket; farewell-videos only stores
-- client-encrypted video ciphertext (EVC1, uploaded as octet-stream).
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/octet-stream']
WHERE id = 'farewell-videos';
