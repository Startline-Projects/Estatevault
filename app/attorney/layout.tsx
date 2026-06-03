"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMyProfile } from "@/lib/api-client/profile";
import PortalSidebar, { PortalNavItem } from "@/components/shared/PortalSidebar";

const navItems: PortalNavItem[] = [
  { label: "Dashboard", href: "/attorney/dashboard" },
  { label: "Document Reviews", href: "/attorney/reviews" },
  { label: "Partners", href: "/attorney/partners" },
  { label: "New Partner", href: "/attorney/new-partner" },
  { label: "Pipeline", href: "/attorney/pipeline" },
  { label: "Commission", href: "/attorney/commission" },
  { label: "Farewell Verification", href: "/attorney/farewell-verification" },
  { label: "Account", href: "/attorney/account" },
];

export default function AttorneyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    getMyProfile().then(({ data }) => {
      setDisplayName(data?.profile?.full_name || data?.profile?.email || "Attorney");
    });
  }, []);

  if (pathname === "/attorney") return <>{children}</>;

  function isActive(href: string, p: string) {
    if (href === "/attorney/dashboard") return p === "/attorney/dashboard";
    if (href === "/attorney/reviews") return p.startsWith("/attorney/reviews") || p.startsWith("/attorney/review");
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
      portalTitle="EstateVault"
      portalSubtitle="Attorney Portal"
      userName={displayName}
      accent="#1C3557"
      isActive={isActive}
      onSignOut={handleSignOut}
    >
      {children}
    </PortalSidebar>
  );
}
