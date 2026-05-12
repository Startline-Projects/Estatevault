"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PortalSidebar, { PortalNavItem } from "@/components/shared/PortalSidebar";

const navItems: PortalNavItem[] = [
  { label: "Dashboard", href: "/pro/sales" },
  { label: "Partners", href: "/pro/sales/partners" },
  { label: "New Partner", href: "/pro/sales/new-partner" },
  { label: "Pipeline", href: "/pro/sales/pipeline" },
  { label: "My Commission", href: "/pro/sales/commission" },
  { label: "Account", href: "/pro/sales/account" },
];

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

  function isActive(href: string, p: string) {
    if (href === "/pro/sales") return p === "/pro/sales";
    return p.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  if (pathname === "/pro/sales/login") return <>{children}</>;

  return (
    <PortalSidebar
      navItems={navItems}
      portalTitle="EstateVault Pro"
      portalSubtitle={portalLabel}
      accent="#1C3557"
      isActive={isActive}
      onSignOut={handleSignOut}
    >
      {children}
    </PortalSidebar>
  );
}
