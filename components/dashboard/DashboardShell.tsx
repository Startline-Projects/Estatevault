"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PortalSidebar, { PortalNavItem } from "@/components/shared/PortalSidebar";

const navItems: PortalNavItem[] = [
  { label: "Home", href: "/dashboard" },
  { label: "My Documents", href: "/dashboard/documents" },
  { label: "My Vault", href: "/dashboard/vault" },
  { label: "Life Events", href: "/dashboard/life-events" },
  { label: "Settings", href: "/dashboard/settings" },
];

const vaultOnlyNavItems = navItems.filter(
  (item) => item.href === "/dashboard/vault" || item.href === "/dashboard/settings"
);

interface DashboardShellProps {
  userName: string;
  children: React.ReactNode;
  vaultOnly?: boolean;
  accentColor?: string;
  portalTitle?: string;
  businessUrl?: string;
}

export default function DashboardShell({
  userName,
  children,
  vaultOnly = false,
  accentColor = "#C9A84C",
  portalTitle = "EstateVault",
  businessUrl = "",
}: DashboardShellProps) {
  const isNorthwood = businessUrl.toLowerCase().includes("northwoodwealthadvisors");
  const sidebarAccent = isNorthwood ? "#4D714C" : accentColor;
  const sidebarPalette = isNorthwood
    ? {
        surface: "#f7f4ed",
        surface2: "#efeadc",
        border: "#e6dfd0",
        iconActiveBg: "#f7f4ed",
        accentDark: "#1a1a1a",
      }
    : undefined;
  const router = useRouter();
  const pathname = usePathname();
  const visibleNavItems = vaultOnly ? vaultOnlyNavItems : navItems;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  function isActive(href: string, p: string) {
    if (href === "/dashboard") return p === "/dashboard";
    return p.startsWith(href);
  }

  return (
    <PortalSidebar
      navItems={visibleNavItems}
      portalTitle={portalTitle}
      portalSubtitle="Client Portal"
      userName={userName}
      accent={sidebarAccent}
      palette={sidebarPalette}
      isActive={isActive}
      onSignOut={handleSignOut}
    >
      <div className="pb-20 md:pb-0">{children}</div>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex justify-around py-2">
        {visibleNavItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
                active ? "font-semibold" : "text-gray-400"
              }`}
              style={active ? { color: accentColor } : undefined}
            >
              <span className="text-lg">•</span>
              <span className="truncate max-w-[56px]">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </PortalSidebar>
  );
}
