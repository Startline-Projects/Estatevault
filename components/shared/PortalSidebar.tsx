"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type PortalNavItem = {
  label: string;
  href: string;
  iconKey?: string;
};

export interface PortalPalette {
  surface?: string;
  surface2?: string;
  border?: string;
  iconActiveBg?: string;
  accentDark?: string;
}

interface PortalSidebarProps {
  navItems: PortalNavItem[];
  secondaryNav?: PortalNavItem[];
  workspaceLabel?: string;
  resourcesLabel?: string;
  portalTitle: string;
  portalSubtitle?: string;
  userName?: string;
  initials?: string;
  accent?: string;
  palette?: PortalPalette;
  isActive?: (href: string, pathname: string) => boolean;
  onSignOut: () => void;
  onNavClick?: (href: string) => void;
  children: React.ReactNode;
}

const SVG_ICONS: Record<string, JSX.Element> = {
  Dashboard: <path d="M3 12L12 3l9 9M5 10v10h4v-6h6v6h4V10" />,
  Home: <path d="M3 12L12 3l9 9M5 10v10h4v-6h6v6h4V10" />,
  "Vault Clients": <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>,
  "My Vault": <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>,
  Clients: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2 2-3.5 4-3.5s3 1 3 3.5" /></>,
  Partners: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2 2-3.5 4-3.5s3 1 3 3.5" /></>,
  "New Partner": <><circle cx="10" cy="8" r="3.5" /><path d="M3 20c0-3 3-5 7-5M17 14v6M14 17h6" /></>,
  Documents: <><path d="M7 3h8l4 4v14H7z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>,
  "My Documents": <><path d="M7 3h8l4 4v14H7z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>,
  "Document Reviews": <><path d="M7 3h8l4 4v14H7z" /><path d="M14 3v5h5M10 14l2 2 4-4" /></>,
  "Life Events": <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 9h16M9 3v4M15 3v4" /></>,
  Referrals: <><path d="M10 14l-4 4M14 10l4-4" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /></>,
  Revenue: <><path d="M3 17l5-5 4 4 8-8" /><path d="M16 8h4v4" /></>,
  Commission: <><path d="M3 17l5-5 4 4 8-8" /><path d="M16 8h4v4" /></>,
  "My Commission": <><path d="M3 17l5-5 4 4 8-8" /><path d="M16 8h4v4" /></>,
  "Partner Commissions": <><path d="M3 17l5-5 4 4 8-8" /><path d="M16 8h4v4" /></>,
  Pipeline: <><path d="M3 6h18M6 12h12M9 18h6" /></>,
  Marketing: <><path d="M3 11l14-7v16L3 13z" /><path d="M7 12v5a2 2 0 004 0" /></>,
  Settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  Account: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></>,
  Training: <><path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M7 11v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5" /></>,
  Support: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 17.5v.01" /></>,
  "Farewell Verification": <><path d="M3 8l9 6 9-6" /><rect x="3" y="5" width="18" height="14" rx="2" /></>,
};

function NavIcon({ label }: { label: string }) {
  const icon = SVG_ICONS[label] || <circle cx="12" cy="12" r="3" />;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {icon}
    </svg>
  );
}

export default function PortalSidebar({
  navItems,
  secondaryNav,
  workspaceLabel = "Workspace",
  resourcesLabel = "Resources",
  portalTitle,
  portalSubtitle,
  userName,
  initials,
  accent = "#C9A84C",
  palette,
  isActive,
  onSignOut,
  onNavClick,
  children,
}: PortalSidebarProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const accentDark = palette?.accentDark || `color-mix(in srgb, ${accent} 60%, #1a1a1a)`;
  const surface = palette?.surface || `color-mix(in srgb, ${accent} 8%, #ffffff)`;
  const surface2 = palette?.surface2 || `color-mix(in srgb, ${accent} 14%, #ffffff)`;
  const borderCol = palette?.border || `color-mix(in srgb, ${accent} 22%, #ffffff)`;
  const iconActiveBg = palette?.iconActiveBg || `color-mix(in srgb, ${accent} 14%, #ffffff)`;

  const sidebarStyle: React.CSSProperties = {
    background: `linear-gradient(180deg, ${surface} 0%, ${surface2} 100%)`,
    borderRight: `1px solid ${borderCol}`,
  };

  function checkActive(href: string) {
    if (isActive) return isActive(href, pathname);
    return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  }

  const computedInitials =
    initials || (portalTitle.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase());

  function NavLink({ item }: { item: PortalNavItem }) {
    const active = checkActive(item.href);
    return (
      <Link
        href={item.href}
        onClick={() => {
          setDrawerOpen(false);
          onNavClick?.(item.href);
        }}
        className={`group relative flex items-center gap-3 mx-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          active
            ? "bg-white text-black shadow-[0_2px_10px_-3px_rgba(0,0,0,0.18)]"
            : "text-black/55 hover:text-black hover:bg-white/60 hover:translate-x-0.5"
        }`}
      >
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full transition-all duration-200"
          style={{
            background: `linear-gradient(180deg, ${accentDark} 0%, ${accent} 100%)`,
            opacity: active ? 1 : 0,
          }}
        />
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            active ? "" : "text-black/45 group-hover:text-black/80"
          }`}
          style={active ? { backgroundColor: iconActiveBg, color: accentDark } : undefined}
        >
          <NavIcon label={item.label} />
        </span>
        <span className="tracking-tight">{item.label}</span>
        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />}
      </Link>
    );
  }

  const sidebar = (
    <>
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${accentDark} 0%, ${accent} 100%)` }}
          >
            {computedInitials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate text-black">{portalTitle}</p>
            {portalSubtitle && (
              <p className="text-[10px] uppercase tracking-[0.14em] text-black/40">{portalSubtitle}</p>
            )}
          </div>
        </div>
        <div className="mt-5 h-px bg-black/10" />
      </div>
      <nav className="flex-1 px-0 space-y-0.5 overflow-y-auto">
        <p className="px-5 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">
          {workspaceLabel}
        </p>
        {navItems.map((item) => <NavLink key={item.href} item={item} />)}
        {secondaryNav && secondaryNav.length > 0 && (
          <>
            <div className="my-4 mx-5 h-px bg-black/10" />
            <p className="px-5 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">
              {resourcesLabel}
            </p>
            {secondaryNav.map((item) => <NavLink key={item.href} item={item} />)}
          </>
        )}
      </nav>
      <div className="px-5 pb-5 pt-4 border-t border-black/5 mt-2 mx-2">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)` }}
          >
            {userName?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            {userName && <p className="text-xs font-medium truncate text-black">{userName}</p>}
            <button onClick={onSignOut} className="text-[11px] text-black/55 hover:text-black transition-colors">
              Sign Out →
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <aside style={sidebarStyle} className="fixed left-0 top-0 z-40 hidden md:flex h-screen w-60 flex-col">
        {sidebar}
      </aside>
      <header
        style={sidebarStyle}
        className="md:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between"
      >
        <button onClick={() => setDrawerOpen(true)} className="text-xl text-black/70">☰</button>
        <span className="text-sm font-bold text-black">{portalSubtitle || portalTitle}</span>
        <div className="w-6" />
      </header>
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div style={sidebarStyle} className="absolute left-0 top-0 h-full w-64 flex flex-col">{sidebar}</div>
        </div>
      )}
      <main className="md:ml-60 pt-14 md:pt-0 min-h-screen">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
