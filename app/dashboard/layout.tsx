import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import DashboardShell from "@/components/dashboard/DashboardShell";
import PasswordChangeBanner from "@/components/dashboard/PasswordChangeBanner";
import { UnlockModal } from "@/components/vault/UnlockModal";
import { BackfillBanner } from "@/components/vault/BackfillBanner";

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

  const { data: client } = await supabase
    .from("clients")
    .select("id, vault_subscription_status")
    .eq("profile_id", user.id)
    .maybeSingle();

  let hasEstatePlanOrder = false;
  if (client?.id) {
    const { data: order } = await supabase
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

  const vaultEntitled =
    client?.vault_subscription_status === "active" || hasEstatePlanOrder;

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
    <DashboardShell userName={name} vaultOnly={isVaultOnlyClient}>
      {requiresPasswordChange && <PasswordChangeBanner />}
      <BackfillBanner />
      {children}
      {pathname.startsWith("/dashboard/vault") && (
        <UnlockModal entitled={vaultEntitled} />
      )}
    </DashboardShell>
  );
}
