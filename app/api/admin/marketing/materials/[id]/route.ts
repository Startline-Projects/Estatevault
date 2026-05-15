import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, BUCKET } from "@/lib/marketing/admin-auth";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/marketing/categories";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").toLowerCase();
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ctype = req.headers.get("content-type") || "";
  const updates: Record<string, unknown> = {};
  let newFile: File | null = null;
  let newIsGlobal: boolean | undefined;
  let newPartnerSlug: string | null | undefined;

  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    if (form.has("title")) updates.title = String(form.get("title") || "").trim();
    if (form.has("description")) updates.description = String(form.get("description") || "").trim() || null;
    if (form.has("category")) updates.category = String(form.get("category") || "other");
    if (form.has("platform")) {
      const p = String(form.get("platform") || "").trim();
      updates.platform = p || null;
    }
    if (form.has("sortOrder")) updates.sort_order = parseInt(String(form.get("sortOrder") || "0"), 10) || 0;
    if (form.has("isGlobal")) {
      newIsGlobal = String(form.get("isGlobal") || "false") === "true";
      updates.is_global = newIsGlobal;
    }
    if (form.has("partnerSlug")) {
      newPartnerSlug = String(form.get("partnerSlug") || "").trim() || null;
      updates.partner_slug = newPartnerSlug;
    }
    const f = form.get("file");
    if (f && f instanceof File && f.size > 0) newFile = f;
  } else {
    const body = await req.json();
    Object.assign(updates, body);
  }

  const { data: existing } = await auth.admin
    .from("marketing_materials")
    .select("storage_path, is_global, partner_slug")
    .eq("id", params.id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (newFile) {
    if (!ALLOWED_MIME.includes(newFile.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    if (newFile.size > MAX_FILE_BYTES) return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
    const targetGlobal = newIsGlobal ?? existing.is_global;
    const targetSlug = newPartnerSlug ?? existing.partner_slug;
    const folder = targetGlobal ? "_global" : targetSlug;
    if (!folder) return NextResponse.json({ error: "Missing target" }, { status: 400 });
    const path = `${folder}/${crypto.randomUUID()}-${safeName(newFile.name)}`;
    const bytes = new Uint8Array(await newFile.arrayBuffer());
    const { error: upErr } = await auth.admin.storage.from(BUCKET).upload(path, bytes, { contentType: newFile.type, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    updates.storage_path = path;
    updates.mime_type = newFile.type;
    updates.file_size_bytes = newFile.size;
  }

  const { data, error } = await auth.admin
    .from("marketing_materials")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (newFile && existing.storage_path) {
    await auth.admin.storage.from(BUCKET).remove([existing.storage_path]);
  }
  return NextResponse.json({ material: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: existing } = await auth.admin
    .from("marketing_materials")
    .select("storage_path")
    .eq("id", params.id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await auth.admin.from("marketing_materials").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing.storage_path) {
    await auth.admin.storage.from(BUCKET).remove([existing.storage_path]);
  }
  return NextResponse.json({ ok: true });
}
