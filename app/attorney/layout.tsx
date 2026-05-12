"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { icon: "\u{1F4CA}", label: "Dashboard", href: "/attorney/dashboard" },
  { icon: "\u{1F4DD}", label: "Document Reviews", href: "/attorney/reviews" },
  { icon: "\u{1F465}", label: "Partners", href: "/attorney/partners" },
  { icon: "\u{2795}", label: "New Partner", href: "/attorney/new-partner" },
  { icon: "\u{1F4C8}", label: "Pipeline", href: "/attorney/pipeline" },
  { icon: "\u{1F4B0}", label: "Commission", href: "/attorney/commission" },
  { icon: "\u{1F3A5}", label: "Farewell Verification", href: "/attorney/farewell-verification" },
  { icon: "\u{2699}", label: "Account", href: "/attorney/account" },
];

export default function AttorneyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
      setDisplayName(data?.full_name || data?.email || "Attorney");
    })();
  }, []);

  if (pathname === "/attorney") return <>{children}</>;

  function isActive(href: string) {
    if (href === "/attorney/dashboard") return pathname === "/attorney/dashboard";
    if (href === "/attorney/reviews") return pathname.startsWith("/attorney/reviews") || pathname.startsWith("/attorney/review");
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
        <p className="text-xs text-gold mt-1">Attorney Portal</p>
        {displayName && <p className="text-xs text-white/40 mt-1 truncate">{displayName}</p>}
        <div className="mt-4 h-px bg-white/10" />
      </div>
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
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
        <button onClick={() => setDrawerOpen(true)} className="text-white/70 text-xl">{"☰"}</button>
        <span className="text-sm font-bold text-white">Attorney Portal</span>
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
