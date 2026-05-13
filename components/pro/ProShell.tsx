"use client";

import { useState, useEffect, useTransition } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { icon: "🏠", label: "Dashboard", href: "/pro/dashboard", basicHidden: false, basicOnly: false },
  { icon: "🔐", label: "Vault Clients", href: "/pro/vault-clients", basicHidden: false, basicOnly: true },
  { icon: "👥", label: "Clients", href: "/pro/clients", basicHidden: true, basicOnly: false },
  { icon: "📄", label: "Documents", href: "/pro/documents", basicHidden: true, basicOnly: false },
  { icon: "🔗", label: "Referrals", href: "/pro/referrals", basicHidden: true, basicOnly: false },
  { icon: "💰", label: "Revenue", href: "/pro/revenue", basicHidden: false, basicOnly: false },
  { icon: "📣", label: "Marketing", href: "/pro/marketing", basicHidden: true, basicOnly: false },
  { icon: "⚙", label: "Settings", href: "/pro/settings", basicHidden: false, basicOnly: false },
];

const secondaryNav = [
  { icon: "🎓", label: "Training", href: "/pro/training", basicHidden: true, basicOnly: false },
  { icon: "💬", label: "Support", href: "/pro/support", basicHidden: false, basicOnly: false },
];

const SVG_ICONS: Record<string, JSX.Element> = {
  Dashboard: <path d="M3 12L12 3l9 9M5 10v10h4v-6h6v6h4V10" />,
  "Vault Clients": <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>,
  Clients: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2 2-3.5 4-3.5s3 1 3 3.5" /></>,
  Documents: <><path d="M7 3h8l4 4v14H7z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>,
  Referrals: <><path d="M10 14l-4 4M14 10l4-4" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /></>,
  Revenue: <><path d="M3 17l5-5 4 4 8-8" /><path d="M16 8h4v4" /></>,
  Marketing: <><path d="M3 11l14-7v16L3 13z" /><path d="M7 12v5a2 2 0 004 0" /></>,
  Settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  Training: <><path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M7 11v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5" /></>,
  Support: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 17.5v.01" /></>,
};

function NavIcon({ label }: { label: string }) {
  const icon = SVG_ICONS[label];
  if (!icon) return null;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {icon}
    </svg>
  );
}

interface ProShellProps {
  companyName: string;
  userName: string;
  tier: string;
  logoUrl: string | null;
  onboardingComplete: boolean;
  certificationComplete: boolean;
  onboardingStep: number;
  businessUrl?: string;
  accentColor?: string;
  children: React.ReactNode;
}

export default function ProShell({ companyName, userName, tier, logoUrl, onboardingComplete, certificationComplete, onboardingStep, businessUrl, accentColor, children }: ProShellProps) {
  const isNorthwood = !!businessUrl?.toLowerCase().includes("northwoodwealthadvisors");
  const accent = accentColor || "#C9A84C";
  const accentDark = isNorthwood ? "#1a1a1a" : `color-mix(in srgb, ${accent} 60%, #1a1a1a)`;

  // Northwood keeps explicit beige theme; everyone else accent-tinted.
  const surface = isNorthwood ? "#f7f4ed" : `color-mix(in srgb, ${accent} 8%, #ffffff)`;
  const surface2 = isNorthwood ? "#efeadc" : `color-mix(in srgb, ${accent} 14%, #ffffff)`;
  const borderCol = isNorthwood ? "#e6dfd0" : `color-mix(in srgb, ${accent} 22%, #ffffff)`;
  const iconActiveBg = isNorthwood ? "#f7f4ed" : `color-mix(in srgb, ${accent} 14%, #ffffff)`;

  const sidebarBgStyle: React.CSSProperties = {
    background: `linear-gradient(180deg, ${surface} 0%, ${surface2} 100%)`,
    borderRight: `1px solid ${borderCol}`,
  };
  const sidebarBgClass = "";
  const txt = "text-black";
  const txtMuted = "text-black/60";
  const txtMutedHover = "text-black/55 hover:text-black";
  const divider = "bg-black/10";
  const theme = {
    sectionLabel: "text-black/35",
    subLabel: "text-black/40",
    activePillCls: "bg-white text-black shadow-[0_2px_10px_-3px_rgba(0,0,0,0.18)]",
    idlePillCls: "text-black/55 hover:text-black hover:bg-white/60 hover:translate-x-0.5",
    footerBorder: "border-t border-black/5",
    mobileBtnTxt: "text-black/70",
    iconActiveStyle: { backgroundColor: iconActiveBg, color: accentDark } as React.CSSProperties,
    iconIdleCls: "text-black/45 group-hover:text-black/80",
    accentBarStyle: { background: `linear-gradient(180deg, ${accentDark} 0%, ${accent} 100%)` } as React.CSSProperties,
    accentDotStyle: { backgroundColor: accent } as React.CSSProperties,
    logoBoxStyle: { background: `linear-gradient(135deg, ${accentDark} 0%, ${accent} 100%)`, color: "#ffffff" } as React.CSSProperties,
    avatarStyle: { background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)` } as React.CSSProperties,
  };
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Clear pending state once navigation lands.
    if (pendingHref && pathname.startsWith(pendingHref)) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  useEffect(() => {
    document.body.classList.remove("theme-northwood");
  }, []);

  // Prefetch every nav route on mount so the first click is instant.
  // Without this, the first navigation pays the JS-bundle + RSC payload cost
  // and the shimmer feels delayed.
  useEffect(() => {
    const all = [...navItems, ...secondaryNav];
    all.forEach((item) => {
      try { router.prefetch(item.href); } catch {}
    });
  }, [router]);

  function isActive(href: string) {
    // Optimistic: if user just clicked a nav item, treat it as active immediately.
    if (pendingHref) {
      if (href === "/pro/dashboard") return pendingHref === "/pro/dashboard";
      return pendingHref.startsWith(href);
    }
    if (href === "/pro/dashboard") return pathname === "/pro/dashboard";
    return pathname.startsWith(href);
  }

  function handleNavClick(e: React.MouseEvent, href: string) {
    if (href === pathname) return;
    e.preventDefault();
    // flushSync forces React to paint shimmer + active-pill BEFORE
    // router.push kicks off the transition (which would otherwise
    // batch the state update and delay paint until route resolves).
    flushSync(() => {
      setDrawerOpen(false);
      setPendingHref(href);
    });
    startTransition(() => router.push(href));
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const initials = companyName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  function NavLink({ item }: { item: { icon: string; label: string; href: string; basicHidden: boolean; basicOnly: boolean } }) {
    const active = isActive(item.href);
    return (
      <Link href={item.href} onClick={(e) => handleNavClick(e, item.href)}
        className={`group relative flex items-center gap-3 mx-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${active ? theme.activePillCls : theme.idlePillCls}`}>
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full transition-all duration-200"
          style={{ ...theme.accentBarStyle, opacity: active ? 1 : 0 }}
        />
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${active ? "" : theme.iconIdleCls}`}
          style={active ? theme.iconActiveStyle : undefined}
        >
          <NavIcon label={item.label} />
        </span>
        <span className="tracking-tight">{item.label}</span>
        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full" style={theme.accentDotStyle} />}
      </Link>
    );
  }

  const sidebar = (
    <>
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="h-9 max-w-full rounded object-contain" />
          ) : (
            <>
              <div className="h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold" style={theme.logoBoxStyle}>{initials}</div>
              <div className="min-w-0">
                <p className={`text-sm font-bold truncate ${txt}`}>{companyName}</p>
                <p className={`text-[10px] uppercase tracking-[0.14em] ${theme.subLabel}`}>Partner Portal</p>
              </div>
            </>
          )}
        </div>
        <div className={`mt-5 h-px ${divider}`} />
      </div>
      <nav className="flex-1 px-0 space-y-0.5 overflow-y-auto">
        <p className={`px-5 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.sectionLabel}`}>Workspace</p>
        {navItems.filter(item => !(tier === "basic" && item.basicHidden) && !(tier !== "basic" && item.basicOnly)).map((item) => <NavLink key={item.href} item={item} />)}
        <div className={`my-4 mx-5 h-px ${divider}`} />
        <p className={`px-5 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.sectionLabel}`}>Resources</p>
        {secondaryNav.filter(item => !(tier === "basic" && item.basicHidden)).map((item) => <NavLink key={item.href} item={item} />)}
      </nav>
      <div className={`px-5 pb-5 pt-4 ${theme.footerBorder} mt-2 mx-2`}>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={theme.avatarStyle}>
            {userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium truncate ${txt}`}>{userName}</p>
            <button onClick={handleSignOut} className={`text-[11px] transition-colors ${txtMutedHover}`}>Sign Out →</button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside style={sidebarBgStyle} className={`fixed left-0 top-0 z-40 hidden md:flex h-screen w-60 flex-col ${sidebarBgClass}`}>{sidebar}</aside>

      {/* Mobile header */}
      <header style={sidebarBgStyle} className={`md:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between ${sidebarBgClass}`}>
        <button onClick={() => setDrawerOpen(true)} className={`text-xl ${theme.mobileBtnTxt}`}>☰</button>
        {logoUrl ? <img src={logoUrl} alt={companyName} className="h-7 object-contain" /> : <span className={`text-sm font-bold ${txt}`}>{companyName}</span>}
        <div className="w-6" />
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div style={sidebarBgStyle} className={`absolute left-0 top-0 h-full w-64 flex flex-col ${sidebarBgClass}`}>{sidebar}</div>
        </div>
      )}

      {/* Center loader during route transition */}
      {(pendingHref || isPending) && (
        <div className="fixed inset-0 md:left-60 z-[60] flex items-center justify-center pointer-events-none animate-[fadeIn_0.15s_ease-out]">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/85 backdrop-blur-md px-8 py-6 shadow-[0_8px_32px_-8px_rgba(28,53,87,0.25)] border border-white/60">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-[3px] border-navy/10" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-gold border-r-gold/60 animate-spin" />
              <div className="absolute inset-1.5 rounded-full border-[2px] border-transparent border-b-navy/40 animate-[spin_1.4s_linear_infinite_reverse]" />
              <div className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-gold animate-pulse" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold tracking-[0.18em] uppercase text-navy/70">Loading</span>
              <span className="flex gap-0.5">
                <span className="h-1 w-1 rounded-full bg-gold animate-[bounce_1s_infinite_0ms]" />
                <span className="h-1 w-1 rounded-full bg-gold animate-[bounce_1s_infinite_150ms]" />
                <span className="h-1 w-1 rounded-full bg-gold animate-[bounce_1s_infinite_300ms]" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="md:ml-60 pt-14 md:pt-0 min-h-screen relative">
        {/* Onboarding/certification banners */}
        {tier !== "basic" && (!onboardingComplete || !certificationComplete) && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-4 text-sm">
            <span className="text-amber-700">⚠</span>
            <span className="text-amber-800">{!onboardingComplete ? "Your setup is incomplete." : "Certification required to unlock client features."}</span>
            {!onboardingComplete && <Link href={`/pro/onboarding/step-${onboardingStep}`} className="font-semibold text-amber-900 underline">Complete Setup →</Link>}
            {onboardingComplete && !certificationComplete && <Link href="/pro/training" className="font-semibold text-amber-900 underline">Complete Certification →</Link>}
          </div>
        )}
        <div className="p-6 md:p-8">{children}</div>
      </main>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
