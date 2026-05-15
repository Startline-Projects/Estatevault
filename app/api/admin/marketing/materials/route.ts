import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, BUCKET } from "@/lib/marketing/admin-auth";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/marketing/categories";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").toLowerCase();
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r) => {
    const { data: pub } = auth.admin.storage.from(BUCKET).getPublicUrl(r.storage_path);
    return { ...r, url: pub.publicUrl };
  });
  return NextResponse.json({ materials: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim() || null;
  const category = String(form.get("category") || "other");
  const platform = String(form.get("platform") || "").trim() || null;
  const sortOrder = parseInt(String(form.get("sortOrder") || "0"), 10) || 0;
  const isGlobal = String(form.get("isGlobal") || "false") === "true";
  const partnerSlug = String(form.get("partnerSlug") || "").trim() || null;

  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
  if (!isGlobal && !partnerSlug) return NextResponse.json({ error: "partnerSlug required when not global" }, { status: 400 });

  const folder = isGlobal ? "_global" : partnerSlug!;
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const path = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}${ext ? "" : ""}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await auth.admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ material: data });
}
