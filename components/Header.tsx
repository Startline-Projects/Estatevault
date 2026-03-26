"use client";

import { useState } from "react";
import Link from "next/link";

const navLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "The Vault", href: "#vault" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gold/40">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-navy tracking-tight">
          EstateVault
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-charcoal hover:text-navy transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <Link
          href="/pro"
          className="hidden md:inline-flex items-center rounded-md border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors"
        >
          For Professionals
        </Link>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span
            className={`block h-0.5 w-6 bg-navy transition-transform ${mobileOpen ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-navy transition-opacity ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-navy transition-transform ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gold/20 bg-white px-6 pb-4">
          <nav className="flex flex-col gap-4 pt-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-charcoal hover:text-navy"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/pro"
              className="inline-flex items-center justify-center rounded-md border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors"
            >
              For Professionals
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
