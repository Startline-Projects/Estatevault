import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";

export const GET = withRoute(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const domain = searchParams.get("domain")?.toLowerCase().trim();
  const slug = searchParams.get("slug");
  if (!id && !domain && !slug) return fail("Missing id|domain|slug", 400);

  const admin = createAdminClient();
  const cols = "id, company_name, product_name, logo_url, accent_color, theme_preset, hero_recipe, highlight_dark, cta_text_override";

  let data: Record<string, unknown> | undefined;

  if (id) {
    const { data: rows } = await admin.from("partners").select(cols).eq("id", id).limit(1);
    data = rows?.[0] as Record<string, unknown> | undefined;
  } else if (slug) {
    const { data: rows } = await admin.from("partners").select(cols).eq("partner_slug", slug).limit(1);
    data = rows?.[0] as Record<string, unknown> | undefined;
  } else if (domain) {
    const [{ data: bySubdomain }, { data: byCustom }] = await Promise.all([
      admin.from("partners").select(cols).eq("subdomain", domain).limit(1),
      admin.from("partners").select(cols).eq("custom_domain", domain).limit(1),
    ]);
    data = (bySubdomain?.[0] || byCustom?.[0]) as Record<string, unknown> | undefined;
  }

  if (!data) return fail("Partner not found", 404);

  return ok({
    id: data.id,
    companyName: data.company_name,
    productName: (data.product_name as string) || "Legacy Protection",
    logoUrl: (data.logo_url as string) || null,
    accentColor: (data.accent_color as string) || "#C9A84C",
    themePresetId: (data.theme_preset as string) || "cool",
    heroRecipeId: (data.hero_recipe as string) || "mesh",
    highlightDark: (data.highlight_dark as string) || null,
    ctaTextOverride: (data.cta_text_override as string) || null,
  });
});
