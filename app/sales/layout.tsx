"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { icon: "\u{1F4CA}", label: "Dashboard", href: "/sales/dashboard" },
  { icon: "\u{1F465}", label: "Partners", href: "/sales/partners" },
  { icon: "\u{2795}", label: "New Partner", href: "/sales/new-partner" },
  { icon: "\u{1F4C8}", label: "Pipeline", href: "/sales/pipeline" },
  { icon: "\u{1F4B0}", label: "My Commission", href: "/sales/commission" },
  { icon: "\u{1F3A5}", label: "Farewell Verification", href: "/sales/farewell-verification" },
  { icon: "\u{2699}", label: "Account", href: "/sales/account" },
];

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // If we're on the login page (/sales), don't render the sidebar layout
  if (pathname === "/sales") {
    return <>{children}</>;
  }

  function isActive(href: string) {
    if (href === "/sales/dashboard") return pathname === "/sales/dashboard";
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const sidebar = (
    <>
      <div className="px-5 pt-5 pb-4">
        <p className="text-lg font-bold text-white">EstateVault <span className="text-gold">Internal</span></p>
        <p className="text-xs text-gold mt-1">Sales Portal</p>
        <div className="mt-4 h-px bg-white/10" />
      </div>
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setDrawerOpen(false)}
            className={`flex items-center gap-3 rounded-r-lg px-4 py-2.5 text-sm font-medium transition-colors ${isActive(item.href) ? "bg-white/10 text-white border-l-2 border-gold" : "text-white/50 hover:bg-white/5 hover:text-white/80 border-l-2 border-transparent"}`}>
            <span className="text-base">{item.icon}</span>{item.label}
          </Link>
        ))}
      </nav>
      <div className="px-5 pb-5">
        <button onClick={handleSignOut} className="text-xs text-white/50 hover:text-white/60">Sign Out</button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed left-0 top-0 z-40 hidden md:flex h-screen w-60 flex-col bg-navy">{sidebar}</aside>
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-navy px-4 py-3 flex items-center justify-between">
        <button onClick={() => setDrawerOpen(true)} className="text-white/70 text-xl">{"\u2630"}</button>
        <span className="text-sm font-bold text-white">Sales Portal</span>
        <div className="w-6" />
      </header>
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-navy flex flex-col">{sidebar}</div>
        </div>
      )}
      <main className="md:ml-60 pt-14 md:pt-0 min-h-screen">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
