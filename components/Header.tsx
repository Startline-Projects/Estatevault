"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const navLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "The Vault", href: "#vault" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-premium border-b border-gold/20"
          : "bg-white border-b border-gold/30"
      }`}
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/logo.svg"
            alt="EstateVault"
            width={44}
            height={44}
            className="transition-transform duration-300 group-hover:scale-105"
            priority
          />
          <span className="text-xl font-bold text-navy tracking-tight hidden sm:inline">
            EstateVault
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                className="relative text-sm font-medium text-charcoal/70 hover:text-navy transition-colors duration-200 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-gold after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="relative text-sm font-medium text-charcoal/70 hover:text-navy transition-colors duration-200 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-gold after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-navy hover:text-navy/70 transition-colors px-4 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/quiz"
            className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 transition-all duration-200 shadow-sm hover:shadow-premium"
          >
            Protect Your Family
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span
            className={`block h-0.5 w-6 bg-navy transition-all duration-300 ${mobileOpen ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-navy transition-all duration-300 ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-navy transition-all duration-300 ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ${
          mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-gold/10 bg-white px-6 pb-6">
          <nav className="flex flex-col gap-1 pt-4">
            {navLinks.map((link) =>
              link.href.startsWith("#") ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-charcoal/70 hover:text-navy hover:bg-navy-50 rounded-lg px-3 py-2.5 transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-charcoal/70 hover:text-navy hover:bg-navy-50 rounded-lg px-3 py-2.5 transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/auth/login"
                className="text-center rounded-lg border border-navy/20 px-4 py-2.5 text-sm font-medium text-navy hover:bg-navy-50 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/quiz"
                className="text-center rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 transition-colors"
              >
                Protect Your Family
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
