"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { icon: "🏠", label: "Dashboard", href: "/pro/dashboard" },
  { icon: "👥", label: "Clients", href: "/pro/clients" },
  { icon: "📄", label: "Documents", href: "/pro/documents" },
  { icon: "🔗", label: "Referrals", href: "/pro/referrals" },
  { icon: "💰", label: "Revenue", href: "/pro/revenue" },
  { icon: "📣", label: "Marketing", href: "/pro/marketing" },
  { icon: "⚙", label: "Settings", href: "/pro/settings" },
];

const secondaryNav = [
  { icon: "🎓", label: "Training", href: "/pro/training" },
  { icon: "💬", label: "Support", href: "/pro/support" },
];

interface ProShellProps {
  companyName: string;
  userName: string;
  tier: string;
  logoUrl: string | null;
  onboardingComplete: boolean;
  certificationComplete: boolean;
  children: React.ReactNode;
}

export default function ProShell({ companyName, userName, tier, logoUrl, onboardingComplete, certificationComplete, children }: ProShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/pro/dashboard") return pathname === "/pro/dashboard";
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/pro/login");
  }

  const initials = companyName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  function NavLink({ item }: { item: { icon: string; label: string; href: string } }) {
    const active = isActive(item.href);
    return (
      <Link href={item.href} onClick={() => setDrawerOpen(false)}
        className={`flex items-center gap-3 rounded-r-lg px-4 py-2.5 text-sm font-medium transition-colors ${active ? "bg-white/10 text-white border-l-2 border-gold" : "text-white/50 hover:bg-white/5 hover:text-white/80 border-l-2 border-transparent"}`}>
        <span className="text-base">{item.icon}</span>{item.label}
      </Link>
    );
  }

  const sidebar = (
    <>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          {logoUrl ? <img src={logoUrl} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center text-xs font-bold text-gold">{initials}</div>}
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{companyName}</p>
            <span className={`text-xs font-medium ${tier === "enterprise" ? "text-gold" : "text-white/40"}`}>{tier === "enterprise" ? "Enterprise" : "Standard"}</span>
          </div>
        </div>
        <div className="mt-4 h-px bg-white/10" />
      </div>
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => <NavLink key={item.href} item={item} />)}
        <div className="my-3 mx-4 h-px bg-white/10" />
        {secondaryNav.map((item) => <NavLink key={item.href} item={item} />)}
      </nav>
      <div className="px-5 pb-5">
        <p className="text-xs text-white/50 truncate">{userName}</p>
        <button onClick={handleSignOut} className="mt-1 text-xs text-white/30 hover:text-white/60">Sign Out</button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden md:flex h-screen w-60 flex-col bg-navy">{sidebar}</aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-navy px-4 py-3 flex items-center justify-between">
        <button onClick={() => setDrawerOpen(true)} className="text-white/70 text-xl">☰</button>
        <span className="text-sm font-bold text-white">{companyName}</span>
        <div className="w-6" />
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-navy flex flex-col">{sidebar}</div>
        </div>
      )}

      {/* Main content */}
      <main className="md:ml-60 pt-14 md:pt-0 min-h-screen">
        {/* Onboarding/certification banners */}
        {(!onboardingComplete || !certificationComplete) && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-4 text-sm">
            <span className="text-amber-700">⚠</span>
            <span className="text-amber-800">Your setup is incomplete.</span>
            {!onboardingComplete && <Link href="/pro/onboarding/step-1" className="font-semibold text-amber-900 underline">Complete Setup →</Link>}
            {onboardingComplete && !certificationComplete && <Link href="/pro/training" className="font-semibold text-amber-900 underline">Complete Certification →</Link>}
          </div>
        )}
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
