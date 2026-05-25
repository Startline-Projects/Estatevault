import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import DashboardShell from "@/components/dashboard/DashboardShell";
import PasswordChangeBanner from "@/components/dashboard/PasswordChangeBanner";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, requires_password_change")
    .eq("id", user.id)
    .single();

  const admin = createAdminClient();

  const { data: clientRows } = await admin
    .from("clients")
    .select("id, vault_subscription_status, partner_id, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  const clientWithPartner = clientRows?.find((c) => c.partner_id) || clientRows?.[0] || null;
  const client = clientWithPartner;

  let partnerAccent = "#C9A84C";
  let partnerTitle = "EstateVault";
  let partnerBusinessUrl = "";
  // Prefer most-recent order's partner so theme reflects current purchase context.
  // Falls back to clients.partner_id if no orders yet.
  let resolvedPartnerId: string | null = null;
  if (client?.id) {
    const { data: ord } = await admin
      .from("orders")
      .select("partner_id")
      .eq("client_id", client.id)
      .not("partner_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ord?.partner_id) resolvedPartnerId = ord.partner_id;
  }
  if (!resolvedPartnerId) resolvedPartnerId = client?.partner_id || null;

  if (resolvedPartnerId) {
    const { data: partner } = await admin
      .from("partners")
      .select("accent_color, company_name, product_name, business_url")
      .eq("id", resolvedPartnerId)
      .maybeSingle();
    if (partner?.accent_color) partnerAccent = partner.accent_color;
    if (partner?.product_name || partner?.company_name) partnerTitle = partner.product_name || partner.company_name;
    if (partner?.business_url) partnerBusinessUrl = partner.business_url;
  }

  let hasEstatePlanOrder = false;
  if (client?.id) {
    const { data: order } = await admin
      .from("orders")
      .select("id")
      .eq("client_id", client.id)
      .in("product_type", ["will", "trust"])
      .limit(1)
      .maybeSingle();
    hasEstatePlanOrder = !!order?.id;
  }

  const isVaultOnlyClient =
    client?.vault_subscription_status === "active" && !hasEstatePlanOrder;

  const pathname = headers().get("x-url") || "/dashboard";
  const vaultOnlyAllowedPaths = ["/dashboard/vault", "/dashboard/settings"];
  const isVaultOnlyPathAllowed = vaultOnlyAllowedPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (isVaultOnlyClient && !isVaultOnlyPathAllowed) {
    redirect("/dashboard/vault");
  }

  const name = profile?.full_name || profile?.email || user.email || "Client";
  const requiresPasswordChange = profile?.requires_password_change === true;

  return (
    <DashboardShell userName={name} vaultOnly={isVaultOnlyClient} accentColor={partnerAccent} portalTitle={partnerTitle} businessUrl={partnerBusinessUrl}>
      {requiresPasswordChange && <PasswordChangeBanner />}
      {children}
    </DashboardShell>
  );
}
