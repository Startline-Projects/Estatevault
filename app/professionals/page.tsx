"use client";

import { useState } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";
import { partnerUrl } from "@/lib/hosts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  professionalType: string;
  clientCount: string;
  referralSource: string;
}

const INITIAL_FORM: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  companyName: "",
  professionalType: "",
  clientCount: "",
  referralSource: "",
};

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-navy text-white px-6 py-20 md:py-24">
      {/* Decorative gradient orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-gold/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-gold/10 blur-3xl"
      />
      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative mx-auto max-w-5xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
          For Michigan Professionals
        </span>

        <h1 className="mt-7 text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
          Turn Estate Planning Conversations
          <br className="hidden md:block" />{" "}
          <span className="bg-gradient-to-r from-gold via-[#e8d48b] to-gold bg-clip-text text-transparent">
            Into Revenue.
          </span>
        </h1>

        <p className="mt-6 mx-auto max-w-2xl text-lg sm:text-xl text-white/70 leading-relaxed">
          Offer your clients attorney-reviewed wills and trusts through your
          own branded platform. You facilitate. You earn. They&rsquo;re
          protected.
        </p>

        <div className="mt-14 grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {/* Stat card */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-7 text-left backdrop-blur-sm transition-all hover:border-white/20 hover:-translate-y-0.5">
            <div
              aria-hidden
              className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gold/10 blur-2xl"
            />
            <div className="relative flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                The Reality
              </p>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 text-gold">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </span>
            </div>
            <p className="relative mt-5 text-5xl sm:text-6xl font-bold text-gold tabular-nums leading-none">
              70<span className="text-3xl sm:text-4xl align-top">%</span>
            </p>
            <div className="relative mt-4 h-px w-12 bg-gradient-to-r from-gold to-transparent" />
            <p className="relative mt-4 text-sm text-white/65 leading-relaxed">
              of your clients have{" "}
              <span className="text-white font-medium">no estate plan</span>.
            </p>
          </div>

          {/* Opportunity card */}
          <div className="group relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.12] via-gold/[0.04] to-transparent p-7 text-left transition-all hover:border-gold/50 hover:-translate-y-0.5">
            <div
              aria-hidden
              className="absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-gold/15 blur-3xl"
            />
            <div className="relative flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                The Opportunity
              </p>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/30 text-gold">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <p className="relative mt-5 text-2xl sm:text-[1.75rem] font-semibold text-white leading-snug">
              You already have the conversation.
            </p>
            <div className="relative mt-4 h-px w-12 bg-gradient-to-r from-gold to-transparent" />
            <p className="relative mt-4 text-base text-gold font-semibold">
              Now get paid for it.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#request-access"
            className="group relative inline-flex items-center gap-2 rounded-full bg-gold px-8 py-4 text-base font-semibold text-navy shadow-lg shadow-gold/30 transition-all hover:shadow-xl hover:shadow-gold/40 hover:-translate-y-0.5"
          >
            Request Access
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-base font-medium text-white/90 transition-colors hover:bg-white/10"
          >
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  How It Works                                                       */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    number: "01",
    eyebrow: "Week 1",
    title: "We set up your branded platform",
    description:
      "Your logo, your colors, your URL. Your clients see your brand, powered by EstateVault.",
    bullets: [
      "Custom subdomain configured",
      "Your brand kit applied",
      "Onboarding call with our team",
    ],
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    number: "02",
    eyebrow: "Day-to-day",
    title: "You introduce it to your clients",
    description:
      "Use our approved scripts and marketing materials. One conversation. No legal expertise required.",
    bullets: [
      "Approved client scripts",
      "Email + social templates",
      "No legal expertise needed",
    ],
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    number: "03",
    eyebrow: "Get Paid Instantly",
    title: "You earn on every document",
    description:
      "Will Package: you earn $300. Trust Package: you earn $400. Paid instantly to your Stripe account on every sale.",
    bullets: [
      "$300 per will, $400 per trust",
      "Instant payout per sale",
      "Real-time revenue dashboard",
    ],
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative py-20 md:py-24 px-6 bg-white overflow-hidden"
    >
      {/* Decorative accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 h-96 w-96 rounded-full bg-gold/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 h-72 w-72 rounded-full bg-navy/5 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            How it works
          </span>
          <h2 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-bold text-navy tracking-tight">
            Simple for you.
            <br />
            <span className="text-charcoal/60">
              Professional for your clients.
            </span>
          </h2>
          <p className="mt-5 text-base text-charcoal/70 leading-relaxed">
            Three steps. No legal training, no infrastructure, no overhead.
            Launch in days — get paid instantly.
          </p>
        </div>

        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_20px_50px_-15px_rgba(28,53,87,0.12)]"
            >
              {/* Step header: number + eyebrow */}
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-gold tabular-nums">
                  {step.number}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-charcoal/50">
                  {step.eyebrow}
                </span>
              </div>

              {/* Divider */}
              <div className="mt-4 h-px w-10 bg-gold transition-all duration-300 group-hover:w-16" />

              {/* Title */}
              <h3 className="mt-5 text-lg font-semibold text-navy leading-snug min-h-[3rem]">
                {step.title}
              </h3>

              {/* Description */}
              <p className="mt-2 text-sm text-charcoal/65 leading-relaxed min-h-[4.5rem]">
                {step.description}
              </p>

              {/* Bullet list */}
              <ul className="mt-5 space-y-2">
                {step.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-sm text-charcoal/75"
                  >
                    <svg
                      className="mt-1 h-3 w-3 flex-shrink-0 text-gold"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Stat strip */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 md:p-8">
          {[
            { value: "3 days", label: "Avg. setup time" },
            { value: "$0", label: "Up-front platform cost option" },
            { value: "Instant", label: "Deposit" },
            { value: "100%", label: "White-label branded" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-navy">
                {s.value}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wider text-charcoal/60">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Who It's For                                                       */
/* ------------------------------------------------------------------ */

const AUDIENCES = [
  {
    title: "Financial Advisors",
    description:
      "Complete the wealth plan with seamless estate planning alongside your investment services.",
    icon: (
      // Chart with rising trend
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
        <path d="M14 8h5v5" />
      </svg>
    ),
  },
  {
    title: "CPAs & Accountants",
    description:
      "Help clients protect the financial picture you already manage with proper estate documents.",
    icon: (
      // Calculator
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <rect x="8" y="6" width="8" height="3" />
        <circle cx="9" cy="13" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="12" cy="13" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="15" cy="13" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="9" cy="16" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="15" cy="16" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Insurance Agents",
    description:
      "A natural extension of beneficiary and protection conversations you already have.",
    icon: (
      // Shield with check
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Attorneys",
    description:
      "Hand off straightforward document preparation. Focus your time on complex cases.",
    icon: (
      // Scales of justice
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v16" />
        <path d="M5 6h14" />
        <path d="M9 20h6" />
        <path d="M6 6l-3 7h6l-3-7z" />
        <path d="M18 6l-3 7h6l-3-7z" />
      </svg>
    ),
  },
];

function WhoItsForSection() {
  return (
    <section className="py-20 md:py-24 px-6 bg-white">
      <div className="mx-auto max-w-5xl">
        <div className="text-center max-w-xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Who it&rsquo;s for
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold text-navy tracking-tight">
            Built for Michigan professionals.
          </h2>
        </div>

        <div className="mt-12 grid gap-px bg-gray-200 rounded-2xl overflow-hidden border border-gray-200 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a) => (
            <div
              key={a.title}
              className="group bg-white p-8 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold transition-colors group-hover:bg-gold group-hover:text-white">
                <span className="h-5 w-5">{a.icon}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold text-navy">
                {a.title}
              </h3>
              <p className="mt-2 text-sm text-charcoal/65 leading-relaxed">
                {a.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  What They Get (Pricing Tiers)                                      */
/* ------------------------------------------------------------------ */

const STANDARD_FEATURES = [
  "White-labeled client portal (your logo + colors)",
  "Wills & trusts Documents (Michigan compliant)",
  "Attorney review add on for clients",
  "Encrypted client Vault (docs, accounts, credentials)",
  "Guided quiz + intake flow for clients",
  "Partner dashboard with client management",
  "Approved scripts + marketing materials library",
  "Instant Stripe payout on every sale",
  "Email support",
];

const ENTERPRISE_FEATURES = [
  "Everything in Standard",
  "Custom subdomain (yourfirm.estatevault.com)",
  "Higher payout: $350 / will · $450 / trust",
  "Priority onboarding with dedicated rep",
  "Co branded marketing campaigns",
  "API access for CRM integration",
  "Document amendment service for clients",
  "Phone + Slack support",
  "Quarterly business reviews",
];

type TierName = "Standard" | "Enterprise";

interface PricingTier {
  name: TierName;
  label: string;
  price: string;
  cadence: string;
  bestFor: string;
  blurb: string;
  earnings: string | null;
  features: string[];
  ctaLabel: string;
  icon: React.ReactNode;
}

const TIERS: PricingTier[] = [
  {
    name: "Standard",
    label: "Standard Partner",
    price: "$1,200",
    cadence: "one-time",
    bestFor: "Best for: growing practices",
    blurb:
      "Full estate planning platform with will and trust document revenue.",
    earnings: "$300 / will · $400 / trust",
    features: STANDARD_FEATURES,
    ctaLabel: "Request Standard Access",
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
        <path d="M14 8h5v5" />
      </svg>
    ),
  },
  {
    name: "Enterprise",
    label: "Enterprise Partner",
    price: "$6,000",
    cadence: "one-time",
    bestFor: "Best for: established firms",
    blurb:
      "Maximum earnings, custom subdomain, and dedicated partnership support.",
    earnings: "$350 / will · $450 / trust",
    features: ENTERPRISE_FEATURES,
    ctaLabel: "Request Enterprise Access",
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7l3 10h12l3-10-5 3-4-7-4 7-5-3z" />
        <circle cx="12" cy="20" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

function PricingCard({ tier }: { tier: PricingTier }) {
  const isDark = tier.name === "Enterprise";

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border p-8 transition-all duration-300 hover:-translate-y-1 ${
        isDark
          ? "border-white/15 bg-gradient-to-b from-navy via-[#152a45] to-[#0f1f33] text-white shadow-[0_4px_24px_-12px_rgba(28,53,87,0.35)] hover:border-gold/40 hover:shadow-[0_28px_56px_-20px_rgba(28,53,87,0.45)]"
          : "border-gray-200/90 bg-white shadow-[0_4px_24px_-12px_rgba(28,53,87,0.12)] hover:border-gold/35 hover:shadow-[0_28px_56px_-20px_rgba(28,53,87,0.18)]"
      }`}
    >
      {/* Tier identity */}
      <header className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/12 to-gold/5 text-gold ring-1 ring-gold/25">
          <span className="h-[22px] w-[22px]">{tier.icon}</span>
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
            {tier.label}
          </p>
          <p
            className={`mt-1 text-sm italic leading-snug ${
              isDark ? "text-gold/85" : "text-gold/90"
            }`}
          >
            {tier.bestFor.replace(/^Best for:\s*/i, "")}
          </p>
        </div>
      </header>

      {/* Setup fee — scannable */}
      <div className="relative mt-7">
        <p
          className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
            isDark ? "text-white/45" : "text-charcoal/50"
          }`}
        >
          One-time setup
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <span
            className={`text-4xl font-bold tracking-tight tabular-nums sm:text-5xl ${
              isDark ? "text-white" : "text-navy"
            }`}
          >
            {tier.price}
          </span>
          <span
            className={`text-sm font-medium ${
              isDark ? "text-white/55" : "text-charcoal/50"
            }`}
          >
            {tier.cadence}
          </span>
        </div>
        <p
          className={`mt-4 text-[15px] leading-relaxed ${
            isDark ? "text-white/75" : "text-charcoal/72"
          }`}
        >
          {tier.blurb}
        </p>
      </div>

      {/* Partner payout */}
      {tier.earnings && (
        <div
          className={`relative mt-6 rounded-2xl px-4 py-4 ${
            isDark ? "bg-white/[0.08] ring-1 ring-white/12" : "bg-navy/[0.04] ring-1 ring-navy/[0.08]"
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
            Your payout per sale
          </p>
          <p
            className={`mt-2 text-[15px] font-semibold leading-snug tabular-nums sm:text-base ${
              isDark ? "text-white" : "text-navy"
            }`}
          >
            {tier.earnings}
          </p>
          <p
            className={`mt-1.5 text-xs leading-relaxed ${
              isDark ? "text-white/50" : "text-charcoal/55"
            }`}
          >
            Paid on each qualifying will or trust package your clients purchase through your portal.
          </p>
        </div>
      )}

      {/* What's included */}
      <div className="relative mt-7 flex flex-1 flex-col min-h-0">
        <p
          className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
            isDark ? "text-white/45" : "text-charcoal/50"
          }`}
        >
          What&apos;s included
        </p>
        <ul
          className={`relative mt-3 space-y-2.5 rounded-2xl p-4 ${
            isDark ? "bg-black/20 ring-1 ring-white/[0.08]" : "bg-gray-50/90 ring-1 ring-gray-100"
          }`}
        >
          {tier.features.map((f) => (
            <li
              key={f}
              className={`flex items-start gap-3 text-[13px] leading-snug ${
                isDark ? "text-white/88" : "text-charcoal/88"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                  isDark ? "bg-gold/25 text-gold" : "bg-gold/20 text-gold"
                }`}
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <a
        href="#request-access"
        className={`relative mt-8 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-6 py-3.5 text-sm font-semibold transition-all ${
          isDark
            ? "bg-gold text-navy shadow-lg shadow-gold/35 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/45"
            : "border border-navy/25 bg-white text-navy hover:border-navy hover:bg-navy hover:text-white"
        }`}
      >
        {tier.ctaLabel}
        <svg
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </a>
    </article>
  );
}

function PricingSection() {
  return (
    <section className="relative py-20 md:py-28 px-6 bg-gradient-to-b from-gray-50/70 via-white to-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-3xl bg-gradient-to-r from-transparent via-gold/35 to-transparent"
      />
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold text-navy tracking-tight">
            Everything you need.
            <br />
            <span className="text-charcoal/70">Nothing you don&rsquo;t.</span>
          </h2>
          <p className="mt-4 text-sm text-charcoal/65 leading-relaxed">
            One-time setup. No monthly platform fees. You earn when your clients purchase document packages.
          </p>
        </div>

        <div className="mx-auto mt-14 flex max-w-4xl flex-col items-stretch justify-center gap-8 md:flex-row md:gap-10">
          {TIERS.map((t) => (
            <div key={t.name} className="flex-1 md:min-h-0 md:max-w-sm">
              <PricingCard tier={t} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Earnings Calculator                                                */
/* ------------------------------------------------------------------ */

type TierKey = "standard" | "professional";

const TIER_CONFIG: Record<
  TierKey,
  {
    label: string;
    price: string;
    trustEarning: number;
    willEarning: number;
    platformFee: number;
  }
> = {
  standard: {
    label: "Standard",
    price: "$1,200 one-time",
    trustEarning: 400,
    willEarning: 300,
    platformFee: 1200,
  },
  professional: {
    label: "Professional",
    price: "$6,000 one-time",
    trustEarning: 450,
    willEarning: 350,
    platformFee: 6000,
  },
};

function EarningsCalculator() {
  const [tier, setTier] = useState<TierKey>("standard");
  const [trustsPerMonth, setTrustsPerMonth] = useState(5);
  const [willsPerMonth, setWillsPerMonth] = useState(5);

  const config = TIER_CONFIG[tier];
  const trustEarnings = trustsPerMonth * config.trustEarning;
  const willEarnings = willsPerMonth * config.willEarning;
  const totalMonthly = trustEarnings + willEarnings;
  const paybackMonths =
    totalMonthly > 0 ? Math.ceil(config.platformFee / totalMonthly) : 0;

  return (
    <section className="relative py-20 md:py-24 px-6 bg-gradient-to-b from-white via-gold/[0.06] to-white">
      <div className="mx-auto max-w-3xl">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Earnings Calculator
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold text-navy tracking-tight">
            See what you could earn.
          </h2>
        </div>

        <div className="mt-10 rounded-3xl bg-white shadow-[0_30px_80px_-20px_rgba(28,53,87,0.25)] ring-1 ring-gray-100 overflow-hidden">
          {/* Tier tabs */}
          <div className="flex p-1.5 bg-gray-50 border-b border-gray-100">
            {(Object.keys(TIER_CONFIG) as TierKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setTier(key)}
                className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-all ${
                  tier === key
                    ? "bg-navy text-white shadow-md shadow-navy/20"
                    : "text-charcoal/60 hover:text-charcoal"
                }`}
              >
                {TIER_CONFIG[key].label}{" "}
                <span className="font-normal opacity-70">
                  · {TIER_CONFIG[key].price}
                </span>
              </button>
            ))}
          </div>

          <div className="p-8 md:p-10">
            {/* Trust slider */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-bold uppercase tracking-[0.15em] text-charcoal/60">
                  Trust Packages / Month
                </label>
                <span className="text-3xl font-bold text-navy tabular-nums">
                  {trustsPerMonth}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={trustsPerMonth}
                onChange={(e) => setTrustsPerMonth(Number(e.target.value))}
                className="w-full accent-gold cursor-pointer h-2"
              />
              <div className="flex justify-between text-xs text-charcoal/40 mt-2">
                <span>1</span>
                <span>30</span>
              </div>
            </div>

            {/* Will slider */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-bold uppercase tracking-[0.15em] text-charcoal/60">
                  Will Packages / Month
                </label>
                <span className="text-3xl font-bold text-navy tabular-nums">
                  {willsPerMonth}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={willsPerMonth}
                onChange={(e) => setWillsPerMonth(Number(e.target.value))}
                className="w-full accent-gold cursor-pointer h-2"
              />
              <div className="flex justify-between text-xs text-charcoal/40 mt-2">
                <span>1</span>
                <span>30</span>
              </div>
            </div>

            {/* Line items */}
            <div className="mt-8 space-y-0">
              <div className="flex items-center justify-between py-5 border-t border-gray-100">
                <div className="text-left">
                  <p className="text-base font-semibold text-charcoal">
                    Trust Package &times; {trustsPerMonth}
                  </p>
                  <p className="text-sm text-charcoal/50 mt-0.5">
                    ${config.trustEarning.toLocaleString()} per package
                  </p>
                </div>
                <p className="text-2xl font-bold text-navy tabular-nums">
                  ${trustEarnings.toLocaleString()}
                </p>
              </div>

              <div className="flex items-center justify-between py-5 border-t border-gray-100">
                <div className="text-left">
                  <p className="text-base font-semibold text-charcoal">
                    Will Package &times; {willsPerMonth}
                  </p>
                  <p className="text-sm text-charcoal/50 mt-0.5">
                    ${config.willEarning.toLocaleString()} per package
                  </p>
                </div>
                <p className="text-2xl font-bold text-navy tabular-nums">
                  ${willEarnings.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="relative mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-[#152a45] to-[#0f1f33] p-10 text-center">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-gold/15 blur-3xl"
              />
              <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Estimated Monthly Earnings
              </p>
              <p className="relative mt-3 text-6xl sm:text-7xl font-bold text-white tabular-nums">
                ${totalMonthly.toLocaleString()}
              </p>
              <p className="relative text-white/50 mt-1 text-sm">per month</p>

              <div className="relative mt-6 inline-flex items-center gap-3 rounded-full bg-white/5 px-5 py-2 ring-1 ring-white/10">
                <span className="text-xs text-white/70">
                  Trusts ${trustEarnings.toLocaleString()}
                </span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="text-xs text-white/70">
                  Wills ${willEarnings.toLocaleString()}
                </span>
              </div>

              <p className="relative mt-6 text-sm text-gold font-medium italic">
                {paybackMonths <= 1
                  ? "Your platform pays for itself in less than 1 month."
                  : `Your platform pays for itself in ${paybackMonths} month${paybackMonths !== 1 ? "s" : ""}.`}
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="px-8 pb-6">
            <p className="text-xs text-charcoal/50 leading-relaxed text-center">
              Earnings shown are estimates based on your selected volume.
              EstateVault does not set, approve, or regulate partner earnings.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Compliance Note                                                    */
/* ------------------------------------------------------------------ */

function ComplianceNote() {
  return (
    <section className="py-10 px-6 bg-gray-50 border-y border-gray-100">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs text-gray-500 leading-relaxed text-center">
          EstateVault Pro is a document preparation platform. It does not
          provide legal advice and does not create an attorney-client
          relationship. Partners are not authorized to provide legal advice
          through the platform. All documents are reviewed for compliance by
          licensed Michigan attorneys. Revenue figures shown are estimates and
          not guarantees of earnings. Actual results will vary based on client
          adoption, market conditions, and partner effort. EstateVault
          Technologies LLC reserves the right to modify pricing and terms at
          any time.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Request Access Form                                                */
/* ------------------------------------------------------------------ */

function RequestAccessForm() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/professionals/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || "Something went wrong. Please try again."
        );
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent text-sm transition-colors";
  const selectClass =
    "w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent text-sm appearance-none [&>option]:text-charcoal [&>option]:bg-white";

  if (submitted) {
    return (
      <section
        id="request-access"
        className="relative py-20 md:py-24 px-6 bg-navy overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-gold/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15 ring-1 ring-green-400/30">
            <svg
              className="h-10 w-10 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mt-7 text-3xl sm:text-4xl font-bold text-white tracking-tight">
            We&rsquo;ve received your request.
          </h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            Our partnerships team will reach out within one business day to
            walk you through everything. We look forward to working with you.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="request-access"
      className="relative overflow-hidden py-20 md:py-24 px-6 bg-navy"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-gold/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-gold/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-2xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Request Access
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
            Let&rsquo;s build your platform.
          </h2>
          <p className="mt-4 text-white/60 text-base">
            Tell us about your practice and our partnerships team will reach
            out within one business day.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 space-y-4 backdrop-blur-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="First Name"
              required
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Last Name"
              required
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              className={inputClass}
            />
          </div>
          <input
            type="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={inputClass}
          />
          <input
            type="tel"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Company / Firm Name"
            value={form.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            className={inputClass}
          />

          <select
            required
            value={form.professionalType}
            onChange={(e) => update("professionalType", e.target.value)}
            className={selectClass}
          >
            <option value="" disabled>
              Professional Type
            </option>
            <option value="financial_advisor">Financial Advisor</option>
            <option value="cpa">CPA / Accountant</option>
            <option value="insurance_agent">Insurance Agent</option>
            <option value="attorney">Attorney</option>
            <option value="other">Other</option>
          </select>

          <select
            value={form.clientCount}
            onChange={(e) => update("clientCount", e.target.value)}
            className={selectClass}
          >
            <option value="" disabled>
              Number of Clients
            </option>
            <option value="1-50">1 to 50</option>
            <option value="51-100">51 to 100</option>
            <option value="101-250">101 to 250</option>
            <option value="251-500">251 to 500</option>
            <option value="500+">500+</option>
          </select>

          <select
            value={form.referralSource}
            onChange={(e) => update("referralSource", e.target.value)}
            className={selectClass}
          >
            <option value="" disabled>
              How did you hear about us?
            </option>
            <option value="google">Google Search</option>
            <option value="linkedin">LinkedIn</option>
            <option value="referral">Colleague / Referral</option>
            <option value="conference">Conference / Event</option>
            <option value="social_media">Social Media</option>
            <option value="other">Other</option>
          </select>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="group w-full inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-4 text-base font-semibold text-navy shadow-lg shadow-gold/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {submitting ? "Submitting..." : "Request Access"}
            {!submitting && (
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            )}
          </button>
        </form>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Nav (minimal for this page)                                        */
/* ------------------------------------------------------------------ */

function ProNav() {
  return (
    <header className="sticky top-0 z-50 bg-navy/95 backdrop-blur-md border-b border-white/10">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 group">
          <img
            src="/logo.svg"
            alt="EstateVault"
            className="h-11 w-11 transition-transform duration-300 group-hover:scale-105"
          />
          <span className="text-xl font-bold text-white tracking-tight hidden sm:inline">
            EstateVault
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={partnerUrl("/auth/login")}
            className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white/90 transition-colors hover:text-white hover:bg-white/10"
          >
            Login
          </a>
          <a
            href="#request-access"
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-navy shadow-md shadow-gold/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/30"
          >
            Request Access
          </a>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ProfessionalsPage() {
  return (
    <>
      <ProNav />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <WhoItsForSection />
        <PricingSection />
        <EarningsCalculator />
        <ComplianceNote />
        <RequestAccessForm />
      </main>
      <Footer />
    </>
  );
}
