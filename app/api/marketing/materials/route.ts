import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

const BUCKET = "marketing-materials";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

function deriveSlug(businessUrl: string | null | undefined, existingSlug: string | null | undefined): string | null {
  if (existingSlug) return existingSlug;
  const u = (businessUrl || "").toLowerCase();
  if (u.includes("northwoodwealthadvisors")) return "northwood";
  return null;
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("marketing_slug, business_url")
    .eq("profile_id", user.id)
    .single();

  const slug = deriveSlug(partner?.business_url, partner?.marketing_slug);

  let query = admin
    .from("marketing_materials")
    .select("id, title, description, category, platform, storage_path, mime_type, sort_order, is_global")
    .order("is_global", { ascending: false })
    .order("sort_order", { ascending: true });

  if (slug) {
    query = query.or(`is_global.eq.true,partner_slug.eq.${slug}`);
  } else {
    query = query.eq("is_global", true);
  }

  const { data: rows, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const materials = (rows || []).map((r) => {
    const { data } = admin.storage.from(BUCKET).getPublicUrl(r.storage_path);
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      mimeType: r.mime_type,
      platform: r.platform,
      isGlobal: r.is_global,
      url: data.publicUrl,
    };
  });

  return NextResponse.json({ slug, materials });
}
