-- ============================================================
-- Migration: Allow application/octet-stream in E2EE buckets
-- Reason: E2EE upload path PUTs opaque ciphertext as
-- application/octet-stream. Bucket mime restrictions reject
-- those with HTTP 400. Add octet-stream to allowed_mime_types.
-- ============================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/octet-stream',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
  'image/jpeg', 'image/png', 'image/jpg'
]
WHERE id = 'farewell-videos';

-- Documents bucket: ciphertext also opaque. Set to NULL to allow any.
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'documents';

SELECT 'E2EE octet-stream mime allowance applied' AS status;
