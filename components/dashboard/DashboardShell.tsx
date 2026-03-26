"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { icon: "🏠", label: "Home", href: "/dashboard" },
  { icon: "📄", label: "My Documents", href: "/dashboard/documents" },
  { icon: "🔐", label: "My Vault", href: "/dashboard/vault" },
  { icon: "📋", label: "Life Events", href: "/dashboard/life-events" },
  { icon: "⚙", label: "Settings", href: "/dashboard/settings" },
];

interface DashboardShellProps {
  userName: string;
  children: React.ReactNode;
}

export default function DashboardShell({ userName, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden md:flex h-screen w-60 flex-col bg-navy">
        <div className="px-6 pt-6 pb-4">
          <Link href="/" className="text-xl font-bold text-white">
            EstateVault
          </Link>
          <div className="mt-4 h-px bg-gold/30" />
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-6 pb-6">
          <p className="text-sm text-white/80 truncate">{userName}</p>
          <button
            onClick={handleSignOut}
            className="mt-2 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-navy px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-white">
          EstateVault
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-white/70 hover:text-white"
          aria-label="Toggle menu"
        >
          <span className="text-xl">{sidebarOpen ? "✕" : "☰"}</span>
        </button>
      </header>

      {/* Mobile slide-out menu */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-navy p-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-lg font-bold text-white">EstateVault</span>
              <button onClick={() => setSidebarOpen(false)} className="text-white/60">✕</button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(item.href) ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  <span>{item.icon}</span>{item.label}
                </Link>
              ))}
            </nav>
            <div className="absolute bottom-6 left-6">
              <p className="text-sm text-white/80">{userName}</p>
              <button onClick={handleSignOut} className="mt-2 text-xs text-white/40 hover:text-white/70">Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex justify-around py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
              isActive(item.href) ? "text-navy font-semibold" : "text-gray-400"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="truncate max-w-[56px]">{item.label.split(" ")[0]}</span>
          </Link>
        ))}
      </nav>

      {/* Main content */}
      <main className="md:ml-60 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
