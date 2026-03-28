"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";

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
    <section className="bg-navy text-white py-20 md:py-28 px-6">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight">
          Turn Estate Planning Conversations Into Revenue.
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Offer your clients attorney-reviewed wills and trusts through your own
          branded platform. You facilitate. You earn. They&rsquo;re protected.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
          <div className="bg-white/10 rounded-xl px-8 py-5">
            <p className="text-2xl sm:text-3xl font-bold text-gold">70%</p>
            <p className="mt-1 text-sm text-gray-300">
              of your clients have no estate plan.
            </p>
          </div>
          <div className="bg-white/10 rounded-xl px-8 py-5">
            <p className="text-sm sm:text-base text-gray-300 max-w-xs leading-relaxed">
              You already have the conversation.{" "}
              <span className="text-gold font-semibold">
                Now get paid for it.
              </span>
            </p>
          </div>
        </div>

        <a
          href="#request-access"
          className="mt-12 inline-flex items-center rounded-full bg-gold px-8 py-4 text-base font-semibold text-white hover:bg-gold/90 transition-colors"
        >
          Request Access
        </a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  How It Works                                                       */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    number: "1",
    title: "We set up your branded platform",
    description:
      "Your logo, your colors, your URL. Your clients see your brand \u2014 powered by EstateVault.",
  },
  {
    number: "2",
    title: "You introduce it to your clients",
    description:
      "Use our approved scripts and marketing materials. One conversation. No legal expertise required.",
  },
  {
    number: "3",
    title: "You earn on every document",
    description:
      "Will Package: you earn $300. Trust Package: you earn $400. Deposited every Friday.",
  },
];

function HowItWorksSection() {
  return (
    <section className="py-20 md:py-24 px-6 bg-white">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl sm:text-3xl font-bold text-navy text-center">
          Simple for you. Professional for your clients.
        </h2>

        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold text-white text-xl font-bold">
                {step.number}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-navy">
                {step.title}
              </h3>
              <p className="mt-3 text-sm text-charcoal/80 leading-relaxed">
                {step.description}
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
    emoji: "\uD83D\uDCC8",
    title: "Financial Advisors",
    description:
      "Estate planning is the missing piece of your holistic wealth plan. Offer it seamlessly alongside your investment services.",
  },
  {
    emoji: "\uD83E\uddEE",
    title: "CPAs & Accountants",
    description:
      "Your clients trust you with their financial picture. Now help them protect it with proper estate documents.",
  },
  {
    emoji: "\uD83D\uDEE1\uFE0F",
    title: "Insurance Agents",
    description:
      "You already discuss beneficiary designations and protection. Estate planning is a natural extension of that conversation.",
  },
  {
    emoji: "\u2696\uFE0F",
    title: "Attorneys",
    description:
      "Focus your time on complex cases. Let EstateVault Pro handle standard document preparation for straightforward clients.",
  },
];

function WhoItsForSection() {
  return (
    <section className="py-20 md:py-24 px-6 bg-gray-50">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl sm:text-3xl font-bold text-navy text-center">
          Built for Michigan professionals.
        </h2>

        <div className="mt-14 grid gap-8 sm:grid-cols-2">
          {AUDIENCES.map((a) => (
            <div
              key={a.title}
              className="rounded-xl border border-gray-200 bg-white p-8 hover:shadow-lg transition-shadow"
            >
              <span className="text-3xl">{a.emoji}</span>
              <h3 className="mt-4 text-lg font-semibold text-navy">
                {a.title}
              </h3>
              <p className="mt-2 text-sm text-charcoal/80 leading-relaxed">
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
  "White-labeled client portal",
  "Your logo and brand colors",
  "Client management dashboard",
  "Real-time revenue tracking",
  "Marketing materials library",
  "Email support",
  "Earn $300/will, $400/trust",
];

const ENTERPRISE_FEATURES = [
  "Everything in Standard",
  "Custom subdomain (yourfirm.estatevault.com)",
  "Priority onboarding with dedicated rep",
  "Earn $350/will, $450/trust",
  "Co-branded marketing campaigns",
  "API access for CRM integration",
  "Phone and Slack support",
  "Quarterly business reviews",
];

function PricingSection() {
  return (
    <section className="py-20 md:py-24 px-6 bg-white">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl sm:text-3xl font-bold text-navy text-center">
          Everything you need. Nothing you don&rsquo;t.
        </h2>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {/* Standard */}
          <div className="rounded-xl border border-gray-200 p-8 flex flex-col">
            <p className="text-sm font-semibold uppercase tracking-wider text-gold">
              Standard Partner
            </p>
            <p className="mt-2 text-3xl font-bold text-navy">
              $1,200<span className="text-base font-normal text-charcoal/60">/year</span>
            </p>
            <ul className="mt-8 flex-1 space-y-4">
              {STANDARD_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-charcoal">
                  <span className="mt-0.5 text-gold font-bold">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#request-access"
              className="mt-8 block text-center rounded-full border-2 border-navy px-6 py-3 text-sm font-semibold text-navy hover:bg-navy hover:text-white transition-colors"
            >
              Get Started
            </a>
          </div>

          {/* Enterprise */}
          <div className="rounded-xl border-2 border-gold bg-navy/[0.02] p-8 flex flex-col relative">
            <span className="absolute -top-3 right-6 rounded-full bg-gold px-4 py-1 text-xs font-semibold text-white">
              Most Popular
            </span>
            <p className="text-sm font-semibold uppercase tracking-wider text-gold">
              Enterprise Partner
            </p>
            <p className="mt-2 text-3xl font-bold text-navy">
              $6,000<span className="text-base font-normal text-charcoal/60">/year</span>
            </p>
            <ul className="mt-8 flex-1 space-y-4">
              {ENTERPRISE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-charcoal">
                  <span className="mt-0.5 text-gold font-bold">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#request-access"
              className="mt-8 block text-center rounded-full bg-gold px-6 py-3 text-sm font-semibold text-white hover:bg-gold/90 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Earnings Calculator                                                */
/* ------------------------------------------------------------------ */

const CLIENT_STOPS = [50, 100, 250, 500, 1000];
const PERCENT_STOPS = [10, 25, 50];

function EarningsCalculator() {
  const [clientIdx, setClientIdx] = useState(1); // default 100
  const [pctIdx, setPctIdx] = useState(1); // default 25%

  const clients = CLIENT_STOPS[clientIdx];
  const pct = PERCENT_STOPS[pctIdx];

  const earnings = useMemo(() => {
    const trusts = Math.round(clients * (pct / 100));
    return trusts * 400;
  }, [clients, pct]);

  const trustsSold = Math.round(clients * (pct / 100));
  const paybackTrusts = Math.ceil(1200 / 400);

  return (
    <section className="py-20 md:py-24 px-6 bg-gold/10">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-navy">
          See what you could earn.
        </h2>

        <div className="mt-12 bg-white rounded-2xl shadow-lg p-8 md:p-12">
          {/* Clients slider */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-3">
              How many clients do you work with?
            </label>
            <input
              type="range"
              min={0}
              max={CLIENT_STOPS.length - 1}
              step={1}
              value={clientIdx}
              onChange={(e) => setClientIdx(Number(e.target.value))}
              className="w-full accent-gold cursor-pointer"
            />
            <div className="flex justify-between text-xs text-charcoal/60 mt-1">
              {CLIENT_STOPS.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <p className="mt-2 text-lg font-semibold text-navy">
              {clients} clients
            </p>
          </div>

          {/* Percentage slider */}
          <div className="mt-10">
            <label className="block text-sm font-medium text-charcoal mb-3">
              What percentage might need estate planning?
            </label>
            <input
              type="range"
              min={0}
              max={PERCENT_STOPS.length - 1}
              step={1}
              value={pctIdx}
              onChange={(e) => setPctIdx(Number(e.target.value))}
              className="w-full accent-gold cursor-pointer"
            />
            <div className="flex justify-between text-xs text-charcoal/60 mt-1">
              {PERCENT_STOPS.map((p) => (
                <span key={p}>{p}%</span>
              ))}
            </div>
            <p className="mt-2 text-lg font-semibold text-navy">{pct}%</p>
          </div>

          {/* Result */}
          <div className="mt-12 rounded-xl bg-navy p-8">
            <p className="text-sm text-gray-300">
              Estimated annual earnings at $400/trust
            </p>
            <p className="mt-2 text-4xl sm:text-5xl font-bold text-gold">
              ${earnings.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {trustsSold} trust packages
            </p>
          </div>

          <p className="mt-6 text-sm text-charcoal/70">
            Your platform pays for itself with just{" "}
            <span className="font-semibold text-navy">{paybackTrusts} trust packages</span>.
          </p>
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
    <section className="py-8 px-6 bg-gray-100">
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
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold text-sm";
  const selectClass =
    "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-gold text-sm appearance-none";

  if (submitted) {
    return (
      <section id="request-access" className="py-20 md:py-24 px-6 bg-navy">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
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
          <h2 className="mt-6 text-2xl sm:text-3xl font-bold text-white">
            Request received!
          </h2>
          <p className="mt-4 text-gray-300">
            Our team will be in touch within one business day. We&rsquo;re
            excited to partner with you.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="request-access" className="py-20 md:py-24 px-6 bg-navy">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center">
          Ready to get started?
        </h2>
        <p className="mt-4 text-gray-300 text-center text-sm">
          Fill out the form below and our partnerships team will be in touch
          within one business day.
        </p>

        <form onSubmit={handleSubmit} className="mt-12 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
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
            <option value="1-50">1 - 50</option>
            <option value="51-100">51 - 100</option>
            <option value="101-250">101 - 250</option>
            <option value="251-500">251 - 500</option>
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
            className="w-full rounded-full bg-gold px-6 py-4 text-base font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Request Access"}
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
    <header className="sticky top-0 z-50 bg-navy border-b border-white/10">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold text-white tracking-tight">
          EstateVault
        </Link>
        <a
          href="#request-access"
          className="inline-flex items-center rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90 transition-colors"
        >
          Request Access
        </a>
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
