"use client";

import { useEffect, useState } from "react";
import {
  buildPartnerTheme,
  buildHeroRecipe,
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

function readCachedBrandingSync(partnerId: string): PartnerBranding | null {
  if (typeof window === "undefined" || !partnerId) return null;
  try {
    const raw = window.sessionStorage.getItem(`partner-branding-${partnerId}`);
    if (!raw) return null;
    return JSON.parse(raw) as PartnerBranding;
  } catch {
    return null;
  }
}

export default function PartnerLoadingScreen({ message }: { message?: string }) {
  const [branding, setBranding] = useState<PartnerBranding | null>(null);
  const [hasPartner, setHasPartner] = useState<boolean | null>(null);

  useEffect(() => {
    const partnerId = resolvePartnerIdSync();
    setHasPartner(!!partnerId);
    if (!partnerId) return;
    const cached = readCachedBrandingSync(partnerId);
    if (cached) setBranding(cached);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/partners/branding?id=${encodeURIComponent(partnerId)}`, { cache: "no-store" });
        if (!cancelled && res.ok) {
          const next = await res.json();
          setBranding(next);
          try {
            window.sessionStorage.setItem(`partner-branding-${partnerId}`, JSON.stringify(next));
          } catch {}
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accent = branding?.accentColor || "#C9A84C";
  const hero = branding
    ? buildHeroRecipe(branding.accentColor, branding.heroRecipeId, {
        highlightDark: branding.highlightDark,
        ctaText: branding.ctaTextOverride,
      })
    : null;
  const theme = branding ? buildPartnerTheme(branding.accentColor, branding.themePresetId) : null;

  const bg = hero?.background || "linear-gradient(135deg, #0E1420 0%, #1C3557 100%)";
  const overlay = hero?.overlay;
  const name = branding?.companyName || (hasPartner ? "" : "EstateVault");
  const initial = (name || "•").charAt(0).toUpperCase();
  const showWordmark = !!name;
  const showLogoBlock = !!branding || !hasPartner;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: bg, minHeight: "100vh" }}
    >
      {overlay && <div className="pointer-events-none absolute inset-0" style={{ background: overlay }} />}

      <div className="relative flex flex-col items-center gap-8 px-6">
        {/* Halo */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div
            className="absolute h-20 w-20 rounded-full blur-2xl opacity-50 animate-pulse"
            style={{ background: accent }}
          />
          <div
            className="absolute h-16 w-16 rounded-full animate-ping"
            style={{ background: accent, opacity: 0.2, animationDuration: "2s" }}
          />
          <div
            className="relative h-10 w-10 rounded-full"
            style={{ background: accent, boxShadow: `0 0 24px ${accent}` }}
          />
        </div>

        {/* Wordmark */}
        <div className="text-center min-h-[60px]">
          {showWordmark && (
            <div className="text-2xl font-semibold tracking-wide text-white drop-shadow-lg">
              {name}
            </div>
          )}
          <div className="mt-2 text-sm text-white/60">
            {message || "Preparing your experience…"}
          </div>
        </div>

        {/* Animated dots */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full animate-bounce"
              style={{
                background: accent,
                animationDelay: `${i * 0.15}s`,
                animationDuration: "1s",
              }}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 w-56 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full w-1/3 rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              animation: "partnerLoaderSlide 1.4s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes partnerLoaderSlide {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(300%); }
            }
          `,
        }}
      />
      {theme ? null : null}
    </div>
  );
}
