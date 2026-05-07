"use client";

import { useState, useEffect } from "react";
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

interface ProShellProps {
  companyName: string;
  userName: string;
  tier: string;
  logoUrl: string | null;
  onboardingComplete: boolean;
  certificationComplete: boolean;
  onboardingStep: number;
  businessUrl?: string;
  children: React.ReactNode;
}

export default function ProShell({ companyName, userName, tier, logoUrl, onboardingComplete, certificationComplete, onboardingStep, businessUrl, children }: ProShellProps) {
  const isNorthwood = !!businessUrl?.toLowerCase().includes("northwoodwealthadvisors");
  const sidebarBgClass = isNorthwood ? "" : "bg-navy";
  const sidebarBgStyle = isNorthwood ? { backgroundColor: "#f7f4ed" } : undefined;
  const txt = isNorthwood ? "text-black" : "text-white";
  const txtMuted = isNorthwood ? "text-black/60" : "text-white/50";
  const txtMutedHover = isNorthwood ? "text-black/60 hover:text-black/80" : "text-white/50 hover:text-white/60";
  const divider = isNorthwood ? "bg-black/10" : "bg-white/10";
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (isNorthwood) document.body.classList.add("theme-northwood");
    return () => { document.body.classList.remove("theme-northwood"); };
  }, [isNorthwood]);

  function isActive(href: string) {
    if (href === "/pro/dashboard") return pathname === "/pro/dashboard";
    return pathname.startsWith(href);
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
      <Link href={item.href} onClick={() => setDrawerOpen(false)}
        className={`flex items-center gap-3 rounded-r-lg px-4 py-2.5 text-sm font-medium transition-colors ${active ? (isNorthwood ? "bg-black/5 text-black border-l-2 border-gold" : "bg-white/10 text-white border-l-2 border-gold") : (isNorthwood ? "text-black/60 hover:bg-black/5 hover:text-black border-l-2 border-transparent" : "text-white/50 hover:bg-white/5 hover:text-white/80 border-l-2 border-transparent")}`}>
        <span className="text-base">{item.icon}</span>{item.label}
      </Link>
    );
  }

  const sidebar = (
    <>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="h-8 max-w-full rounded object-contain" />
          ) : (
            <>
              <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center text-xs font-bold text-gold">{initials}</div>
              <div className="min-w-0">
                <p className={`text-sm font-bold truncate ${txt}`}>{companyName}</p>
              </div>
            </>
          )}
        </div>
        <div className={`mt-4 h-px ${divider}`} />
      </div>
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.filter(item => !(tier === "basic" && item.basicHidden) && !(tier !== "basic" && item.basicOnly)).map((item) => <NavLink key={item.href} item={item} />)}
        <div className={`my-3 mx-4 h-px ${divider}`} />
        {secondaryNav.filter(item => !(tier === "basic" && item.basicHidden)).map((item) => <NavLink key={item.href} item={item} />)}
      </nav>
      <div className="px-5 pb-5">
        <p className={`text-xs truncate ${txtMuted}`}>{userName}</p>
        <button onClick={handleSignOut} className={`mt-1 text-xs ${txtMutedHover}`}>Sign Out</button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside style={sidebarBgStyle} className={`fixed left-0 top-0 z-40 hidden md:flex h-screen w-60 flex-col ${sidebarBgClass}`}>{sidebar}</aside>

      {/* Mobile header */}
      <header style={sidebarBgStyle} className={`md:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between ${sidebarBgClass}`}>
        <button onClick={() => setDrawerOpen(true)} className={`text-xl ${isNorthwood ? "text-black/70" : "text-white/70"}`}>☰</button>
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

      {/* Main content */}
      <main className="md:ml-60 pt-14 md:pt-0 min-h-screen">
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
    </div>
  );
}
