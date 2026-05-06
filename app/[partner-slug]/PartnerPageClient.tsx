"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { buildPartnerTheme, themeToCssVars, buildHeroRecipe, type ThemePresetId, type HeroRecipeId } from "@/lib/partner-pages/theme";

export interface PartnerBranding {
  id: string;
  companyName: string;
  productName: string;
  logoUrl: string | null;
  accentColor: string;
  themePresetId?: ThemePresetId;
  heroRecipeId?: HeroRecipeId;
  highlightDark?: string | null;
  highlightLight?: string | null;
  ctaTextOverride?: string | null;
  partnerId: string;
}

// ─── FAQ Accordion ────────────────────────────────────────────────────────────

const faqs = [
  { q: "Are these real legal documents?", a: "Yes. All documents are attorney-reviewed, Michigan-specific, and legally valid when properly executed. They are not generic templates." },
  { q: "How long does it take?", a: "Most clients complete the quiz and intake in 10 to 15 minutes. Your documents are generated immediately after purchase." },
  { q: "What is the Family Vault?", a: "The Vault is a secure encrypted storage system inside your account where you can store your estate documents, insurance policies, financial account details, and digital credentials, everything your family needs in one place." },
  { q: "Is my information secure?", a: "Yes. All data is protected with 256-bit AES encryption. Your Vault has a separate PIN from your account password. Our platform meets bank-grade security standards." },
  { q: "What happens after I purchase?", a: "Your documents are generated immediately. You receive a download link by email and permanent access through your account. An execution guide walks you through signing requirements." },
  { q: "Can I update my documents later?", a: "Yes. Life events like marriage, divorce, new children, or new property can be reflected through a document amendment for $50." },
];

function AccordionItem({
  q, a, isOpen, onToggle, accentColor,
}: {
  q: string; a: string; isOpen: boolean; onToggle: () => void; accentColor: string;
}) {
  return (
    <div
      className={`border rounded-xl transition-all duration-300 ${
        isOpen ? "border-navy-100" : "border-transparent hover:bg-gray-50"
      }`}
      style={isOpen ? { background: "rgba(28,53,87,0.03)" } : {}}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span
          className={`text-base font-medium transition-colors duration-200 ${
            isOpen ? "text-navy" : "text-charcoal/80"
          }`}
        >
          {q}
        </span>
        <span
          className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300"
          style={{
            background: isOpen ? accentColor : "#e5e7eb",
            color: isOpen ? "white" : "#9ca3af",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: isOpen ? "300px" : "0px", opacity: isOpen ? 1 : 0 }}
      >
        <div className="px-6 pb-5">
          <p className="text-sm text-charcoal/60 leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Full Branded Page ────────────────────────────────────────────────────────

export default function PartnerPageClient({ branding }: { branding: PartnerBranding }) {
  const { companyName, productName, logoUrl, accentColor, themePresetId, heroRecipeId, highlightDark, highlightLight, ctaTextOverride, partnerId } = branding;
  const theme = useMemo(() => buildPartnerTheme(accentColor, themePresetId ?? "cool"), [accentColor, themePresetId]);
  const themeVars = useMemo(() => themeToCssVars(theme) as React.CSSProperties, [theme]);
  const heroRecipe = useMemo(
    () => buildHeroRecipe(accentColor, heroRecipeId ?? "mesh", { highlightDark, ctaText: ctaTextOverride }),
    [accentColor, heroRecipeId, highlightDark, ctaTextOverride]
  );
  const lightHighlight = highlightLight || theme.palette["800"];
  const lightTintBg = theme.palette["100"];
  const heroBgStyle: React.CSSProperties = {
    background: heroRecipe.background,
    color: heroRecipe.heroText,
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const quizHref = `/quiz?partner=${partnerId}`;
  const willHref = `/will?partner=${partnerId}`;
  const trustHref = `/trust?partner=${partnerId}`;

  const vaultCategories = [
    {
      label: "Estate Documents",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      label: "Financial Accounts",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
    },
    {
      label: "Insurance Policies",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
    {
      label: "Digital Accounts & Passwords",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      ),
    },
    {
      label: "Physical Document Locations",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      ),
    },
    {
      label: "Important Contacts",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
  ];

  const testimonials = [
    { quote: "Getting my trust done was so much easier than I expected. 15 minutes and it was done.", name: "Sarah M.", city: "Grand Rapids", initials: "SM" },
    { quote: "My financial advisor recommended this. The vault feature alone is worth it.", name: "James T.", city: "Detroit", initials: "JT" },
    { quote: "I kept putting off estate planning for years. This made it finally happen.", name: "Linda K.", city: "Ann Arbor", initials: "LK" },
  ];

  const navLinks = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
    { label: "The Vault", href: "#vault" },
  ];

  return (
    <div style={themeVars}>
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 bg-white border-b transition-all duration-300"
        style={{ borderColor: accentColor + "33" }}
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
          <a href="#" className="flex items-center gap-3 group">
            {logoUrl ? (
              <span className="flex items-center gap-2 text-xl font-bold text-navy tracking-tight">
                <img src={logoUrl} alt={companyName} className="h-8 w-auto object-contain" />
                <span className="mx-1 font-normal text-charcoal/50">/</span>
                <span className="text-charcoal/80">Legacy</span>
              </span>
            ) : (
              <span className="text-xl font-bold text-navy tracking-tight">
                {companyName}
                <span className="mx-2 font-normal text-charcoal/50">/</span>
                <span className="text-charcoal/80">Legacy</span>
              </span>
            )}
          </a>

          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative text-sm font-medium text-charcoal/70 hover:text-navy transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-navy hover:text-navy/70 transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link
              href={quizHref}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 shadow-sm hover:opacity-90"
              style={{ background: accentColor }}
            >
              Protect Your Family
            </Link>
          </div>

          <button
            className="lg:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span className={`block h-0.5 w-6 bg-navy transition-all duration-300 ${mobileOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-6 bg-navy transition-all duration-300 ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-6 bg-navy transition-all duration-300 ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>

        <div className={`lg:hidden overflow-hidden transition-all duration-300 ${mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="border-t bg-white px-6 pb-6" style={{ borderColor: accentColor + "1a" }}>
            <nav className="flex flex-col gap-1 pt-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-charcoal/70 hover:text-navy rounded-lg px-3 py-2.5 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <Link href="/auth/login" className="text-center rounded-lg border border-navy/20 px-4 py-2.5 text-sm font-medium text-navy">
                  Sign In
                </Link>
                <Link
                  href={quizHref}
                  className="text-center rounded-full px-4 py-2.5 text-sm font-semibold text-white"
                  style={{ background: accentColor }}
                >
                  Protect Your Family
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main>
        {/* ── HERO ───────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden" style={heroBgStyle}>
          {heroRecipe.overlay && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: heroRecipe.overlay }} />
          )}

          <div className="relative z-10 py-24 px-6 md:py-32 lg:py-40">
            <div className="mx-auto max-w-4xl text-center">
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 border"
                style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.14)" }}
              >
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium tracking-wide uppercase" style={{ color: heroRecipe.heroSubtext }}>
                  {productName}, Trusted by Michigan Families
                </span>
              </div>

              <h1
                className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] tracking-tight"
                style={{ color: heroRecipe.heroText, textShadow: "0 2px 24px rgba(0,0,0,0.25)" }}
              >
                Protect Your Family.
                <br />
                <span style={{ color: heroRecipe.heroHighlight }}>
                  Peace of Mind in Minutes.
                </span>
              </h1>

              <p className="mt-6 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: heroRecipe.heroSubtext }}>
                Attorney-reviewed wills and trusts built for Michigan families.
                Your documents and a secure family vault, all in one place.
              </p>

              <div className="mt-10 flex flex-col items-center gap-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link href={willHref} className="w-full sm:w-auto rounded-full bg-white/10 border border-white/25 px-10 py-4 text-base font-semibold text-white transition-all duration-300 hover:bg-white/20 hover:border-white/40 hover:scale-[1.02] active:scale-[0.98] text-center">
                    Create a Will
                  </Link>
                  <Link href={trustHref} className="w-full sm:w-auto rounded-full bg-white/10 border border-white/25 px-10 py-4 text-base font-semibold text-white transition-all duration-300 hover:bg-white/20 hover:border-white/40 hover:scale-[1.02] active:scale-[0.98] text-center">
                    Create a Trust
                  </Link>
                </div>
                <Link
                  href={quizHref}
                  className="group relative w-full sm:w-auto rounded-full px-10 py-4 text-base font-semibold text-white transition-all duration-300 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] text-center shadow-lg overflow-hidden"
                  style={{ background: accentColor }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <span className="text-white/80 font-normal">Not sure?</span>
                    Take a free quiz
                  </span>
                </Link>
              </div>

              <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" style={{ color: heroRecipe.heroHighlight }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                  SSL Secured
                </div>
                <div className="w-px h-4 bg-white/20" />
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" style={{ color: heroRecipe.heroHighlight }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
                  256-bit Encrypted
                </div>
                <div className="w-px h-4 bg-white/20" />
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" style={{ color: heroRecipe.heroHighlight }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Attorney-Reviewed
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUST BAR ──────────────────────────────────────────────────────── */}
        <section className="bg-white py-5 px-6 border-b border-gray-100">
          <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-center gap-8 md:gap-14">
            {[
              { label: "Attorney-Reviewed", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" /></svg> },
              { label: "256-bit Encrypted", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg> },
              { label: "State-Specific Documents", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> },
              { label: "Secure Family Vault", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg> },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 text-navy/60">
                <span style={{ color: lightHighlight }}>{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
        <section id="how-it-works" className="bg-white py-24 px-6">
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-4 py-1.5 mb-4">
              <span className="text-xs font-semibold text-navy tracking-wide uppercase">Three Steps</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-navy tracking-tight">Built Around Your Life</h2>
            <p className="mt-4 text-lg text-charcoal/60 max-w-xl mx-auto">From first question to fully protected, in about 15 minutes.</p>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
              {[
                { number: 1, title: "Tell us about your family", description: "A short, guided conversation about your life and wishes. Plain English, no legal jargon.", icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg> },
                { number: 2, title: "Your plan is created", description: "Personalized, attorney-reviewed documents built specifically for your family and Michigan law.", icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> },
                { number: 3, title: "Everything is secured", description: "Your documents and family vault, encrypted and accessible whenever your loved ones need them.", icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg> },
              ].map((step, idx) => (
                <div key={step.number} className="relative group">
                  {idx < 2 && (
                    <div
                      className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px"
                      style={{ background: `linear-gradient(to right, ${accentColor}66, ${accentColor}1a)` }}
                    />
                  )}
                  <div className="relative flex flex-col items-center p-8 rounded-2xl bg-white border border-gray-100 shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:-translate-y-1">
                    <div
                      className="absolute -top-3 left-6 px-3 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: lightTintBg, color: lightHighlight }}
                    >
                      Step {step.number}
                    </div>
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-navy to-navy-800 text-white shadow-lg group-hover:scale-105 transition-transform duration-300">
                      {step.icon}
                    </div>
                    <h3 className="mt-6 text-lg font-bold text-navy">{step.title}</h3>
                    <p className="mt-3 text-sm text-charcoal/60 leading-relaxed max-w-xs">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PACKAGE CARDS ──────────────────────────────────────────────────── */}
        <section id="pricing" className="relative bg-gradient-to-b from-gray-50 to-white py-24 px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4" style={{ background: lightTintBg }}>
              <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: lightHighlight }}>One-Time Payment</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-navy tracking-tight">Simple, Honest Pricing</h2>
            <p className="mt-4 text-lg text-charcoal/60 max-w-xl mx-auto">Pay once. No subscriptions, no hidden fees, no surprises.</p>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { title: "Will Package", descriptor: "Direct your wishes through the court", price: "$400", popular: false, features: ["Last Will & Testament", "Durable Power of Attorney", "Healthcare Directive", "Execution Guide", "Family Vault Access"], cta: "Begin Your Will", href: willHref },
                { title: "Trust Package", descriptor: "Bypass probate and protect privately", price: "$600", popular: true, features: ["Revocable Living Trust", "Pour-Over Will", "Durable Power of Attorney", "Healthcare Directive", "Asset Funding Checklist", "Family Vault Access", "Attorney Review Available"], cta: "Begin Your Trust", href: trustHref },
              ].map((pkg) => (
                <div
                  key={pkg.title}
                  className="relative group flex flex-col h-full rounded-2xl bg-white p-8 text-left transition-all duration-300 hover:-translate-y-1"
                  style={{
                    border: pkg.popular ? `2px solid ${accentColor}` : "1px solid #e5e7eb",
                    boxShadow: pkg.popular ? `0 4px 24px ${accentColor}22` : undefined,
                  }}
                >
                  {pkg.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 text-xs font-bold text-white shadow-lg"
                        style={{ background: accentColor }}
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        Most Popular
                      </span>
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-navy">{pkg.title}</h3>
                  <p className="mt-1 text-sm text-charcoal/50">{pkg.descriptor}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-navy tracking-tight">{pkg.price}</span>
                    <span className="text-sm text-charcoal/50 ml-1">one-time</span>
                  </div>
                  <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                  <ul className="mt-6 space-y-3.5">
                    {pkg.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-charcoal/70">
                        <svg className="mt-0.5 w-5 h-5 shrink-0" style={{ color: lightHighlight }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    <Link
                      href={pkg.href}
                      className="block w-full rounded-xl py-3.5 text-center text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.01]"
                      style={{ background: pkg.popular ? accentColor : "#1C3557" }}
                    >
                      {pkg.cta}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── VAULT SECTION ──────────────────────────────────────────────────── */}
        <section id="vault" className="relative py-24 px-6 overflow-hidden" style={heroBgStyle}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 right-10 w-64 h-64 rounded-full blur-3xl animate-float" style={{ background: accentColor + "0d" }} />
            <div className="absolute -bottom-10 left-20 w-48 h-48 rounded-full blur-3xl animate-float-delayed" style={{ background: accentColor + "0d" }} />
          </div>

          <div className="relative z-10 mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 py-1.5 mb-4">
              <svg className="w-4 h-4" style={{ color: heroRecipe.heroHighlight }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="text-xs font-semibold text-white/70 tracking-wide uppercase">Secure Vault</span>
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" style={{ color: heroRecipe.heroText, textShadow: "0 2px 16px rgba(0,0,0,0.25)" }}>
              More Than Documents  <br className="hidden sm:block" />
              <span style={{ color: heroRecipe.heroHighlight }}>
                A Complete Family Vault
              </span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Everything your family needs, in one secure place. Bank-grade encryption. A separate PIN. Accessible when it matters most.
            </p>

            <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-4">
              {vaultCategories.map((cat) => (
                <div key={cat.label} className="group glass rounded-2xl p-6 text-center hover:bg-white/12 transition-all duration-300 hover:-translate-y-0.5">
                  <div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300"
                    style={{ background: "rgba(255,255,255,0.10)", color: heroRecipe.heroHighlight }}
                  >
                    {cat.icon}
                  </div>
                  <p className="text-sm font-medium text-white/80">{cat.label}</p>
                </div>
              ))}
            </div>

            <Link
              href={quizHref}
              className="mt-14 inline-flex items-center gap-2 rounded-full border-2 px-8 py-3.5 text-sm font-semibold transition-all duration-300 hover:bg-white/10 group"
              style={{ borderColor: heroRecipe.heroHighlight, color: heroRecipe.heroHighlight }}
            >
              Start With the Free Quiz
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </section>

        {/* ── SOCIAL PROOF ───────────────────────────────────────────────────── */}
        <section className="bg-white py-24 px-6">
          <div className="mx-auto max-w-5xl text-center">
            <div className="flex flex-col items-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 mb-6">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700 tracking-wide uppercase">Families Protected</span>
              </div>
              <p className="text-6xl md:text-7xl font-bold text-navy tracking-tight">2,847</p>
              <p className="mt-2 text-lg text-charcoal/60">Michigan families protected and counting</p>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <div key={t.name} className="group rounded-2xl border border-gray-100 bg-white p-7 text-left shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:-translate-y-0.5">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4" style={{ color: lightHighlight }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm text-charcoal/70 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-5 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: accentColor }}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy">{t.name}</p>
                      <p className="text-xs text-charcoal/50">{t.city}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────────── */}
        <section id="faq" className="bg-gradient-to-b from-white to-gray-50 py-24 px-6">
          <div className="mx-auto max-w-3xl">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-4 py-1.5 mb-4">
                <span className="text-xs font-semibold text-navy tracking-wide uppercase">FAQ</span>
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-navy tracking-tight">Questions We Hear Most</h2>
              <p className="mt-4 text-lg text-charcoal/60">Honest answers about how this works.</p>
            </div>
            <div className="space-y-2">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.q}
                  q={faq.q}
                  a={faq.a}
                  isOpen={openFaq === index}
                  onToggle={() => setOpenFaq(openFaq === index ? null : index)}
                  accentColor={accentColor}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ──────────────────────────────────────────────────────── */}
        <section className="relative py-24 px-6 overflow-hidden" style={heroBgStyle}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 left-1/4 w-80 h-80 rounded-full blur-3xl animate-float" style={{ background: accentColor + "0d" }} />
            <div className="absolute -bottom-20 right-1/3 w-64 h-64 rounded-full blur-3xl animate-float-delayed" style={{ background: accentColor + "0d" }} />
          </div>
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight" style={{ color: heroRecipe.heroText, textShadow: "0 2px 16px rgba(0,0,0,0.25)" }}>
              Your family is counting<br />on{" "}
              <span style={{ color: heroRecipe.heroHighlight }}>
                you.
              </span>
            </h2>
            <p className="mt-5 text-lg text-white/60">Start with a free quiz. No commitment until you&apos;re ready.</p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={quizHref}
                className="group relative rounded-full px-10 py-4 text-base font-semibold transition-all duration-300 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                style={{ background: accentColor, color: heroRecipe.ctaText }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Take the Free Quiz
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-white/50">
              <div className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Takes 15 minutes</div>
              <div className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>256-bit encrypted</div>
              <div className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>Attorney-reviewed</div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      {(() => {
        const c = (a: number) => `rgba(28,53,87,${a})`;
        return (
          <footer className="py-16 px-6 bg-white border-t border-gray-100" style={{ color: "#1C3557" }}>
            <div className="mx-auto max-w-6xl">
              <div className="flex flex-col md:flex-row items-start justify-between gap-10">
                <div className="flex flex-col gap-4">
                  {logoUrl ? (
                    <span className="flex items-center gap-2 text-lg font-bold" style={{ color: theme.heroText }}>
                      <img src={logoUrl} alt={companyName} className="h-8 w-auto object-contain" />
                      <span className="mx-1 font-normal" style={{ color: c(0.40) }}>/</span>
                      <span style={{ color: c(0.80) }}>Legacy</span>
                    </span>
                  ) : (
                    <span className="text-lg font-bold" style={{ color: theme.heroText }}>
                      {companyName}
                      <span className="mx-2 font-normal" style={{ color: c(0.40) }}>/</span>
                      <span style={{ color: c(0.80) }}>Legacy</span>
                    </span>
                  )}
                  <p className="text-sm max-w-xs" style={{ color: c(0.55) }}>{productName}, Estate planning for Michigan families.</p>
                </div>
                <div className="flex gap-16">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: c(0.60) }}>Legal</h4>
                    <nav className="flex flex-col gap-3 text-sm">
                      <Link href="/privacy" className="transition-colors duration-200" style={{ color: c(0.55) }}>Privacy Policy</Link>
                      <Link href="/terms" className="transition-colors duration-200" style={{ color: c(0.55) }}>Terms of Service</Link>
                    </nav>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: c(0.60) }}>Product</h4>
                    <nav className="flex flex-col gap-3 text-sm">
                      <Link href={quizHref} className="transition-colors duration-200" style={{ color: c(0.55) }}>Free Quiz</Link>
                      <Link href={willHref} className="transition-colors duration-200" style={{ color: c(0.55) }}>Will Package</Link>
                      <Link href={trustHref} className="transition-colors duration-200" style={{ color: c(0.55) }}>Trust Package</Link>
                    </nav>
                  </div>
                </div>
              </div>

              <div className="my-10 h-px" style={{ background: c(0.12) }} />

              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs" style={{ color: c(0.55) }}>&copy; {new Date().getFullYear()} {companyName}. All rights reserved.</p>
                <p className="text-xs" style={{ color: c(0.40) }}>Powered by <span style={{ color: c(0.60) }}>EstateVault</span></p>
              </div>

              <p className="mt-6 text-xs leading-relaxed max-w-4xl" style={{ color: c(0.45) }}>
                This platform provides document preparation services only. It does not provide legal advice. No attorney-client relationship is created by your use of this platform.
              </p>
            </div>
          </footer>
        );
      })()}
    </div>
  );
}
