import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin, BUCKET } from "@/lib/marketing/admin-auth";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/marketing/categories";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").toLowerCase();
}

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error, auth.status);

  const { searchParams } = new URL(req.url);
  const partnerSlug = searchParams.get("partnerSlug");

  let q = auth.admin
    .from("marketing_materials")
    .select("id, partner_slug, is_global, title, description, category, platform, storage_path, mime_type, file_size_bytes, sort_order, updated_at")
    .order("is_global", { ascending: false })
    .order("partner_slug", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });

  if (partnerSlug === "_global") q = q.eq("is_global", true);
  else if (partnerSlug) q = q.eq("partner_slug", partnerSlug);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);

  const rows = (data || []).map((r) => {
    const { data: pub } = auth.admin.storage.from(BUCKET).getPublicUrl(r.storage_path);
    return { ...r, url: pub.publicUrl };
  });
  return ok({ materials: rows });
});

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error, auth.status);

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim() || null;
  const category = String(form.get("category") || "other");
  const platform = String(form.get("platform") || "").trim() || null;
  const sortOrder = parseInt(String(form.get("sortOrder") || "0"), 10) || 0;
  const isGlobal = String(form.get("isGlobal") || "false") === "true";
  const partnerSlug = String(form.get("partnerSlug") || "").trim() || null;

  if (!file) return fail("Missing file", 400);
  if (!title) return fail("Missing title", 400);
  if (!ALLOWED_MIME.includes(file.type)) return fail("Unsupported file type", 400);
  if (file.size > MAX_FILE_BYTES) return fail("File too large (max 25MB)", 400);
  if (!isGlobal && !partnerSlug) return fail("partnerSlug required when not global", 400);

  const folder = isGlobal ? "_global" : partnerSlug!;
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const path = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}${ext ? "" : ""}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await auth.admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return fail(upErr.message, 500);

  const { data, error } = await auth.admin
    .from("marketing_materials")
    .insert({
      partner_slug: isGlobal ? null : partnerSlug,
      is_global: isGlobal,
      title,
      description,
      category,
      platform: category === "social" ? platform : null,
      storage_path: path,
      mime_type: file.type,
      file_size_bytes: file.size,
      sort_order: sortOrder,
      uploaded_by: auth.userId,
    })
    .select()
    .single();

  if (error) {
    await auth.admin.storage.from(BUCKET).remove([path]);
    return fail(error.message, 500);
  }
  return ok({ material: data });
});
