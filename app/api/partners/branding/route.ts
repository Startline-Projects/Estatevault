import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const domain = searchParams.get("domain")?.toLowerCase().trim();
  const slug = searchParams.get("slug");
  if (!id && !domain && !slug) return NextResponse.json({ error: "Missing id|domain|slug" }, { status: 400 });

  const admin = createAdminClient();
  const cols = "id, company_name, product_name, logo_url, accent_color, theme_preset, hero_recipe, highlight_dark, cta_text_override";

  let query = admin.from("partners").select(cols).limit(1);
  if (id) query = query.eq("id", id);
  else if (slug) query = query.eq("partner_slug", slug);
  else if (domain) query = query.or(`subdomain.eq.${domain},custom_domain.eq.${domain}`);

  const { data: rows, error } = await query;
  const data = rows?.[0];

  if (error || !data) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    companyName: data.company_name,
    productName: data.product_name || "Legacy Protection",
    logoUrl: data.logo_url || null,
    accentColor: data.accent_color || "#C9A84C",
    themePresetId: data.theme_preset || "cool",
    heroRecipeId: data.hero_recipe || "mesh",
    highlightDark: data.highlight_dark || null,
    ctaTextOverride: data.cta_text_override || null,
  });
}
