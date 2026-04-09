import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import PartnerPageClient from "./PartnerPageClient";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

const reserved = [
  "pro", "auth", "dashboard", "quiz", "will", "trust", "api",
  "attorney-referral", "sales", "attorney", "farewell", "professionals",
  "contact", "privacy", "terms", "partners",
];

export default async function PartnerLandingPage({
  params,
}: {
  params: { "partner-slug": string };
}) {
  const slug = params["partner-slug"];
  if (reserved.includes(slug)) return redirect("/");

  const supabase = createAdminClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("id, company_name, product_name, logo_url, accent_color, partner_slug")
    .eq("partner_slug", slug)
    .in("status", ["active", "onboarding"])
    .single();

  if (!partner) return redirect("/");

  return (
    <PartnerPageClient
      branding={{
        id: partner.id,
        companyName: partner.company_name,
        productName: partner.product_name || "Legacy Protection",
        logoUrl: partner.logo_url || null,
        accentColor: partner.accent_color || "#C9A84C",
        partnerId: partner.id,
      }}
    />
  );
}
