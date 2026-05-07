"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PartnerLoadingScreen from "./PartnerLoadingScreen";
import {
  buildPartnerTheme,
  buildHeroRecipe,
  themeToCssVars,
  type ThemePresetId,
  type HeroRecipeId,
} from "@/lib/partner-pages/theme";

interface PartnerBranding {
  id: string;
  companyName: string;
  productName: string;
  logoUrl: string | null;
  accentColor: string;
  themePresetId: ThemePresetId;
  heroRecipeId: HeroRecipeId;
  highlightDark: string | null;
  ctaTextOverride: string | null;
}

interface ShellProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

const PartnerBrandingContext = createContext<PartnerBranding | null>(null);

export function usePartnerBranding(): PartnerBranding | null {
  return useContext(PartnerBrandingContext);
}

export function BrandedLoadingWordmark({ className = "animate-pulse text-white/80 text-xl font-bold" }: { className?: string }) {
  const branding = useContext(PartnerBrandingContext);
  return <div className={className}>{branding?.companyName || "EstateVault"}</div>;
}

function resolvePartnerIdSync(): string {
  if (typeof window === "undefined") return "";
  return (
    new URLSearchParams(window.location.search).get("partner") ||
    window.sessionStorage.getItem("trustPartner") ||
    window.sessionStorage.getItem("willPartner") ||
    window.sessionStorage.getItem("quizPartner") ||
    ""
  );
}

export default function PartnerThemedShell({ children, showHeader = true }: ShellProps) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const partnerId = resolvePartnerIdSync();
    if (!partnerId) {
      setResolved(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/partners/branding?id=${encodeURIComponent(partnerId)}`, { cache: "no-store" });
        if (cancelled) return;
        const next: PartnerBranding | null = res.ok ? await res.json() : null;
        setBranding(next);
      } catch {
        setBranding(null);
      } finally {
        if (!cancelled) setResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const themed = useMemo(() => {
    if (!branding) return null;
    const theme = buildPartnerTheme(branding.accentColor, branding.themePresetId);
    const hero = buildHeroRecipe(branding.accentColor, branding.heroRecipeId, {
      highlightDark: branding.highlightDark,
      ctaText: branding.ctaTextOverride,
    });
    const cssVars = themeToCssVars(theme) as React.CSSProperties;
    return { theme, hero, cssVars };
  }, [branding]);

  if (!resolved) {
    return <PartnerLoadingScreen />;
  }

  if (!branding || !themed) {
    return <PartnerBrandingContext.Provider value={null}>{children}</PartnerBrandingContext.Provider>;
  }

  const { hero, cssVars } = themed;

  const rootStyle: React.CSSProperties = {
    ...cssVars,
    background: hero.background,
    minHeight: "100vh",
  };

  return (
    <PartnerBrandingContext.Provider value={branding}>
    <div className="partner-themed relative" style={rootStyle}>
      {hero.overlay && (
        <div className="pointer-events-none fixed inset-0 z-0" style={{ background: hero.overlay }} />
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .partner-themed .min-h-screen.bg-navy { background-color: transparent !important; }
        .partner-themed .bg-navy:not(.min-h-screen) { background-color: var(--brand-800) !important; }
        .partner-themed .hover\\:bg-navy\\/90:hover { background-color: var(--brand-900) !important; }
        .partner-themed .bg-navy\\/80 { background-color: rgba(0, 0, 0, 0.25) !important; }
        .partner-themed .bg-gold { background-color: var(--brand-accent) !important; }
        .partner-themed .bg-gold\\/10 { background-color: var(--brand-100) !important; }
        .partner-themed .bg-gold\\/90 { background-color: var(--brand-700) !important; }
        .partner-themed .text-gold { color: var(--brand-accent) !important; }
        .partner-themed .text-gold\\/80 { color: var(--brand-700) !important; }
        .partner-themed .border-gold { border-color: var(--brand-accent) !important; }
        .partner-themed .border-gold\\/40 { border-color: var(--brand-300) !important; }
        .partner-themed .border-gold\\/30 { border-color: var(--brand-200) !important; }
        .partner-themed .border-gold\\/20 { border-color: var(--brand-200) !important; }
        .partner-themed .hover\\:bg-gold\\/90:hover { background-color: var(--brand-700) !important; }
        .partner-themed .hover\\:text-gold\\/80:hover { color: var(--brand-700) !important; }
        .partner-themed .hover\\:border-gold\\/40:hover { border-color: var(--brand-300) !important; }
        .partner-themed .focus\\:border-gold:focus { border-color: var(--brand-accent) !important; }
        .partner-themed .focus\\:ring-gold\\/30:focus { --tw-ring-color: var(--brand-200) !important; }
        .partner-themed .accent-gold { accent-color: var(--brand-accent) !important; }
        .partner-themed .shadow-gold { box-shadow: 0 4px 24px -2px var(--brand-200) !important; }
      `,
        }}
      />

      {showHeader && (
        <header
          className="relative z-20 bg-white"
          style={{ borderBottom: `1px solid ${branding.accentColor}33` }}
        >
          <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
            <Link href={`/${branding.id ? `?partner=${branding.id}` : ""}`} className="flex items-center gap-3">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.companyName}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <span className="text-lg font-bold tracking-tight text-navy">
                  {branding.companyName}
                </span>
              )}
              <span className="hidden sm:inline text-xs font-medium text-charcoal/70">
                {branding.productName}
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-charcoal/60">
                Powered by EstateVault
              </span>
            </div>
          </div>
        </header>
      )}

      <div className="relative z-10">{children}</div>
    </div>
    </PartnerBrandingContext.Provider>
  );
}
