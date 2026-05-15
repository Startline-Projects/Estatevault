"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PortalSidebar, { PortalNavItem } from "@/components/shared/PortalSidebar";

const baseNavItems: PortalNavItem[] = [
  { label: "Dashboard", href: "/sales/dashboard" },
  { label: "Partners", href: "/sales/partners" },
  { label: "New Partner", href: "/sales/new-partner" },
  { label: "Pipeline", href: "/sales/pipeline" },
];

const tailNavItems: PortalNavItem[] = [
  { label: "Farewell Verification", href: "/sales/farewell-verification" },
  { label: "Account", href: "/sales/account" },
];

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
      setIsAdmin(data?.user_type === "admin");
    })();
  }, []);

  const portalLabel = isAdmin ? "Admin Portal" : "Sales Portal";
  const commissionItem: PortalNavItem = {
    label: isAdmin ? "Partner Commissions" : "My Commission",
    href: "/sales/commission",
  };
  // Affiliate program oversight is admin-only for now.
  const adminItems: PortalNavItem[] = isAdmin
    ? [
        { label: "Affiliates", href: "/sales/affiliates" },
        { label: "Marketing Materials", href: "/sales/marketing-materials" },
      ]
    : [];
  const navItems = [...baseNavItems, commissionItem, ...adminItems, ...tailNavItems];

  if (pathname === "/sales") return <>{children}</>;

  function isActive(href: string, p: string) {
    if (href === "/sales/dashboard") return p === "/sales/dashboard";
    return p.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <PortalSidebar
      navItems={navItems}
      portalTitle="EstateVault Internal"
      portalSubtitle={portalLabel}
      accent="#1C3557"
      isActive={isActive}
      onSignOut={handleSignOut}
    >
      {children}
    </PortalSidebar>
  );
}
