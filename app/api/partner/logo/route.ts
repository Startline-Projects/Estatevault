import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

const VALID_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

// B2: partner logo upload, server-side. Replaces the client-side
// `supabase.storage.from("logos").upload(...)` + self-update of logo_url the
// branding screens ran. Uploads under the partner's own id, sets logo_url, and
// returns the public URL. Falls back to the "documents" bucket if "logos" is
// unavailable (matches the prior client behavior).
export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("partner not found", 404);

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return fail("missing file", 400);
  if (!VALID_TYPES.includes(file.type)) return fail("unsupported file type", 400);
  if (file.size > MAX_BYTES) return fail("file too large (max 5MB)", 400);

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const path = `logos/${partner.id}-${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  let bucket = "logos";
  const { error: upErr } = await auth.admin.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) {
    bucket = "documents";
    const { error: fallbackErr } = await auth.admin.storage
      .from(bucket)
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (fallbackErr) {
      console.error("[partner/logo upload]", fallbackErr);
      return fail("upload failed", 500);
    }
  }

  const { data: pub } = auth.admin.storage.from(bucket).getPublicUrl(path);
  await partnerRepo.update(auth.admin, partner.id, { logo_url: pub.publicUrl });
  return ok({ url: pub.publicUrl });
});
