'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PRACTICE_AREAS = [
  'Estate Planning',
  'Elder Law',
  'Family Law',
  'Probate',
  'Business/Corporate',
  'Real Estate',
  'Tax Law',
  'Medicaid Planning',
  'Special Needs Planning',
  'General Practice',
] as const;

const HOURS_OPTIONS = [
  '1-5 hours/week',
  '5-10 hours/week',
  '10-20 hours/week',
  '20+ hours/week',
] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReviewNetworkPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    firmName: '',
    barNumber: '',
    desiredReviewFee: '300',
    practiceAreas: [] as string[],
    availableHours: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function togglePracticeArea(area: string) {
    setFormData((prev) => {
      const areas = prev.practiceAreas.includes(area)
        ? prev.practiceAreas.filter((a) => a !== area)
        : [...prev.practiceAreas, area];
      return { ...prev, practiceAreas: areas };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/professionals/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          companyName: formData.firmName,
          professionalType: 'review_attorney',
          bar_number: formData.barNumber,
          desired_review_fee: formData.desiredReviewFee,
          practice_areas: formData.practiceAreas,
          clientCount: formData.availableHours,
          referralSource: 'review_network_page',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Something went wrong.');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- render ---------- */

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-navy">
            EstateVault
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/partners/attorneys"
              className="text-navy font-medium hover:text-navy/80 transition-colors"
            >
              Become a Partner
            </Link>
            <span className="text-gray-300">|</span>
            <a
              href="mailto:info@estatevault.us"
              className="text-gray-500 hover:text-charcoal transition-colors"
            >
              info@estatevault.us
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-navy text-white py-16 md:py-24 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Earn Per Review.{' '}
            <span className="text-gold">No Platform Required.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Join the EstateVault Review Network and get paid to review AI-generated estate planning
            documents. Set your own fee. Accept cases on your schedule. No platform purchase required.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-navy text-center mb-10">
            How the Review Network works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: 1,
                title: 'Cases come to you',
                desc: 'When a client opts for attorney review, we match them with a review attorney based on practice area and availability.',
              },
              {
                step: 2,
                title: 'You review and approve',
                desc: 'Review the AI-generated documents, request changes if needed, and approve for delivery. Average review time: 30-45 minutes.',
              },
              {
                step: 3,
                title: 'You get paid',
                desc: 'Your review fee is paid directly to you for each completed review. No platform fees, no revenue splits on the review fee.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold text-navy text-lg font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-charcoal">{item.title}</h3>
                <p className="mt-2 text-sm text-charcoal/60 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form section */}
      <section className="py-16 px-6 bg-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-navy text-center">
            Join the Review Network
          </h2>
          <p className="mt-3 text-center text-charcoal/60">
            Fill out the form below and we&apos;ll be in touch within one business day.
          </p>

          {submitted ? (
            <div className="mt-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-navy">Application received!</p>
              <p className="mt-3 text-charcoal/60">
                A member of our team will review your application and reach out within one business day.
              </p>
              <Link
                href="/partners/attorneys"
                className="mt-8 inline-block text-gold font-semibold hover:text-gold/80 underline underline-offset-4 transition-colors"
              >
                Back to Attorney Partners
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              {/* Name row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="Smith"
                  />
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="john@lawfirm.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="(555) 555-1234"
                  />
                </div>
              </div>

              {/* Firm + Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Firm Name</label>
                  <input
                    type="text"
                    value={formData.firmName}
                    onChange={(e) => updateField('firmName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="Smith & Associates"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Michigan Bar Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.barNumber}
                    onChange={(e) => updateField('barNumber', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="P12345"
                  />
                </div>
              </div>

              {/* Desired review fee */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">
                  Desired Review Fee (per document)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                  <input
                    type="number"
                    min={150}
                    max={1500}
                    value={formData.desiredReviewFee}
                    onChange={(e) => updateField('desiredReviewFee', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 pl-8 pr-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="300"
                  />
                </div>
                <p className="mt-1 text-xs text-charcoal/60">Range: $150 to $1,500 per review</p>
              </div>

              {/* Practice areas */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-3">Practice Areas *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PRACTICE_AREAS.map((area) => (
                    <label key={area} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.practiceAreas.includes(area)}
                        onChange={() => togglePracticeArea(area)}
                        className="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy/50 accent-navy"
                      />
                      <span className="text-sm text-charcoal/70 group-hover:text-charcoal transition-colors">
                        {area}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Available hours */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">
                  Available Hours Per Week
                </label>
                <select
                  value={formData.availableHours}
                  onChange={(e) => updateField('availableHours', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors appearance-none bg-white"
                >
                  <option value="">Select...</option>
                  {HOURS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gold hover:bg-gold/90 disabled:opacity-60 disabled:cursor-not-allowed text-navy font-bold text-lg px-8 py-4 rounded-lg transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Join Review Network'
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy/95 py-12 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <p className="text-lg font-bold text-white">EstateVault</p>
              <p className="mt-1 text-sm text-gray-400">Protect Everything That Matters</p>
            </div>

            <nav className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
                Contact
              </Link>
            </nav>

            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} EstateVault Technologies LLC
            </p>
          </div>

          <hr className="my-8 border-white/10" />

          <p className="text-xs text-gray-500 leading-relaxed max-w-4xl">
            This platform provides document preparation services only. It does not
            provide legal advice. No attorney-client relationship is created by
            your use of this platform. Documents should be reviewed by a licensed
            attorney if you have questions about your specific legal situation.
          </p>
        </div>
      </footer>
    </div>
  );
}
