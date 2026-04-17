'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  firmName: string;
  barNumber: string;
  yearsInPractice: string;
  practiceArea: string;
  password: string;
  confirmPassword: string;
  agreementAccepted: boolean;
  reviewFee: number;
}

const YEARS_OPTIONS = [
  '0-2 years',
  '3-5 years',
  '6-10 years',
  '11-20 years',
  '20+ years',
] as const;

const PRACTICE_AREAS = [
  'Estate Planning',
  'Elder Law',
  'Family Law',
  'General Practice',
  'Business/Corporate',
  'Real Estate',
  'Probate',
  'Tax Law',
  'Other',
] as const;

const TIER_CONFIG = {
  standard: {
    name: 'Standard',
    price: 1200,
    willEarning: 300,
    trustEarning: 400,
  },
  professional: {
    name: 'Professional',
    price: 6000,
    willEarning: 350,
    trustEarning: 500,
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function AttorneySignupContent() {
  const searchParams = useSearchParams();
  const tierParam = searchParams.get('tier');
  const promoParam = searchParams.get('promo');
  const tier = tierParam === 'professional' ? 'professional' : 'standard';
  const config = TIER_CONFIG[tier];
  const isPromoFree = promoParam?.toUpperCase() === 'TPFP';

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    firmName: '',
    barNumber: '',
    yearsInPractice: '',
    practiceArea: '',
    password: '',
    confirmPassword: '',
    agreementAccepted: false,
    reviewFee: 300,
  });

  /* ---------- helpers ---------- */

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function validateStep1(): boolean {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setError('First name, last name, and email are required.');
      return false;
    }
    if (!formData.barNumber) {
      setError('Michigan Bar Number is required.');
      return false;
    }
    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    if (!formData.agreementAccepted) {
      setError('You must accept the Partner Agreement to continue.');
      return false;
    }
    setError('');
    return true;
  }

  function validateStep2(): boolean {
    if (formData.reviewFee < 150 || formData.reviewFee > 1500) {
      setError('Review fee must be between $150 and $1,500.');
      return false;
    }
    setError('');
    return true;
  }

  async function handlePayment() {
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        tier,
        email: formData.email,
        name: `${formData.firstName} ${formData.lastName}`,
        first_name: formData.firstName,
        last_name: formData.lastName,
        firm_name: formData.firmName,
        bar_number: formData.barNumber,
        review_fee: formData.reviewFee,
        practice_area: formData.practiceArea,
        years_in_practice: formData.yearsInPractice,
        phone: formData.phone,
        password: formData.password,
        promo_code: isPromoFree ? 'TPFP' : undefined,
      };

      const res = await fetch('/api/checkout/attorney', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create checkout session.');
      }

      // If promo was applied and account created directly (no Stripe)
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }

      if (data.url) {
        // Store password in sessionStorage so the verify endpoint can use it
        // instead of storing it in Stripe metadata
        sessionStorage.setItem("ev_attorney_pwd", formData.password);
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  /* Earnings calculations */
  const willWithReview = config.willEarning + formData.reviewFee;
  const trustWithReview = config.trustEarning + formData.reviewFee;
  const monthlyEstimate = 10 * trustWithReview;

  /* ---------- render ---------- */

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/partners/attorneys" className="text-xl font-bold text-navy">
            EstateVault
          </Link>
          <span className="text-sm text-charcoal/50">Attorney Partner Signup</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-3 mb-12">
          {[
            { num: 1, label: 'Your Details' },
            { num: 2, label: 'Review Fee' },
            { num: 3, label: 'Payment' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step >= s.num
                      ? 'bg-navy text-white'
                      : 'bg-gray-200 text-charcoal/60'
                  }`}
                >
                  {step > s.num ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s.num
                  )}
                </div>
                <span className={`text-sm font-medium hidden sm:inline ${step >= s.num ? 'text-navy' : 'text-charcoal/60'}`}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div className={`w-12 h-0.5 ${step > s.num ? 'bg-navy' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Tier badge */}
        <div className="text-center mb-8">
          <span className="inline-block bg-navy/10 text-navy text-sm font-semibold px-4 py-1.5 rounded-full">
            {config.name} Plan, ${config.price.toLocaleString()}
          </span>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ============================================================ */}
        {/*  STEP 1, Your Details                                       */}
        {/* ============================================================ */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-navy">Your Details</h2>
            <p className="mt-2 text-sm text-charcoal/60">Tell us about yourself and your practice.</p>

            <div className="mt-8 space-y-5">
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

              {/* Firm Name */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Firm Name</label>
                <input
                  type="text"
                  value={formData.firmName}
                  onChange={(e) => updateField('firmName', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                  placeholder="Smith & Associates PLLC"
                />
              </div>

              {/* Bar Number */}
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
                <p className="mt-1.5 text-xs text-charcoal/50">
                  Your bar number will be verified with the State Bar of Michigan before your account is activated.
                </p>
              </div>

              {/* Years + Practice Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Years in Practice</label>
                  <select
                    value={formData.yearsInPractice}
                    onChange={(e) => updateField('yearsInPractice', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors appearance-none bg-white"
                  >
                    <option value="">Select...</option>
                    {YEARS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Primary Practice Area</label>
                  <select
                    value={formData.practiceArea}
                    onChange={(e) => updateField('practiceArea', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors appearance-none bg-white"
                  >
                    <option value="">Select...</option>
                    {PRACTICE_AREAS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Password *</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              {/* Agreement checkbox */}
              <label className="flex items-start gap-3 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={formData.agreementAccepted}
                  onChange={(e) => updateField('agreementAccepted', e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy/50 accent-navy"
                />
                <span className="text-sm text-charcoal/70">
                  I agree to the{' '}
                  <a href="/terms" className="text-navy underline underline-offset-2">
                    Partner Agreement
                  </a>{' '}
                  and confirm that I am a licensed attorney in good standing with the State Bar of Michigan. *
                </span>
              </label>
            </div>

            <button
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
              className="mt-8 w-full bg-gold hover:bg-gold/90 text-navy font-bold text-lg px-6 py-4 rounded-lg transition-colors"
            >
              Continue to Review Fee &rarr;
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/*  STEP 2, Set Your Review Fee                                */}
        {/* ============================================================ */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-navy">Set Your Review Fee</h2>
            <p className="mt-2 text-sm text-charcoal/60">
              This is the fee clients pay you for reviewing their documents. You keep 100% of it.
            </p>

            {/* Large fee input */}
            <div className="mt-10 text-center">
              <label className="block text-sm font-semibold text-charcoal/50 uppercase tracking-wider mb-4">
                Your Review Fee Per Document
              </label>
              <div className="flex items-center justify-center gap-2">
                <span className="text-4xl font-bold text-charcoal">$</span>
                <input
                  type="number"
                  min={150}
                  max={1500}
                  value={formData.reviewFee}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) updateField('reviewFee', Math.min(1500, Math.max(150, v)));
                  }}
                  className="w-40 text-center text-5xl font-bold text-navy border-b-2 border-gold bg-transparent outline-none focus:border-navy transition-colors"
                />
              </div>
              <input
                type="range"
                min={150}
                max={1500}
                step={25}
                value={formData.reviewFee}
                onChange={(e) => updateField('reviewFee', parseInt(e.target.value, 10))}
                className="mt-6 w-full max-w-md mx-auto block accent-gold"
              />
              <div className="flex justify-between text-xs text-charcoal/60 mt-1 max-w-md mx-auto">
                <span>$150 min</span>
                <span>$1,500 max</span>
              </div>
            </div>

            {/* Live earnings preview */}
            <div className="mt-12">
              <h3 className="text-lg font-bold text-navy text-center mb-6">Your Earnings Preview</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-charcoal/60">Document</th>
                      <th className="text-right py-3 px-4 font-semibold text-charcoal/60">Platform Split</th>
                      <th className="text-right py-3 px-4 font-semibold text-charcoal/60">Review Fee</th>
                      <th className="text-right py-3 px-4 font-semibold text-navy">Total You Earn</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 text-charcoal">Will Package</td>
                      <td className="py-3 px-4 text-right text-charcoal/70">${config.willEarning}</td>
                      <td className="py-3 px-4 text-right text-charcoal/70">${formData.reviewFee}</td>
                      <td className="py-3 px-4 text-right font-bold text-navy">${willWithReview}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 text-charcoal">Will (no review)</td>
                      <td className="py-3 px-4 text-right text-charcoal/70">${config.willEarning}</td>
                      <td className="py-3 px-4 text-right text-charcoal/60">-</td>
                      <td className="py-3 px-4 text-right font-bold text-charcoal/70">${config.willEarning}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 text-charcoal">Trust Package</td>
                      <td className="py-3 px-4 text-right text-charcoal/70">${config.trustEarning}</td>
                      <td className="py-3 px-4 text-right text-charcoal/70">${formData.reviewFee}</td>
                      <td className="py-3 px-4 text-right font-bold text-navy">${trustWithReview}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 text-charcoal">Trust (no review)</td>
                      <td className="py-3 px-4 text-right text-charcoal/70">${config.trustEarning}</td>
                      <td className="py-3 px-4 text-right text-charcoal/60">-</td>
                      <td className="py-3 px-4 text-right font-bold text-charcoal/70">${config.trustEarning}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Monthly estimate */}
              <div className="mt-8 bg-navy/5 rounded-xl p-6 text-center border border-navy/10">
                <p className="text-sm font-semibold text-charcoal/60 uppercase tracking-wider">
                  Estimated Monthly (10 clients with review)
                </p>
                <p className="mt-2 text-4xl font-extrabold text-gold">
                  ${monthlyEstimate.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-charcoal/60">
                  Based on 10 trust packages with review per month
                </p>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-shrink-0 px-6 py-4 rounded-lg border border-gray-300 text-charcoal font-medium hover:bg-gray-50 transition-colors"
              >
                &larr; Back
              </button>
              <button
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
                className="flex-1 bg-gold hover:bg-gold/90 text-navy font-bold text-lg px-6 py-4 rounded-lg transition-colors"
              >
                Continue to Payment &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/*  STEP 3, Payment                                            */}
        {/* ============================================================ */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-navy">Complete Your Purchase</h2>
            <p className="mt-2 text-sm text-charcoal/60">
              Review your order and proceed to secure payment.
            </p>

            {/* Order summary */}
            <div className="mt-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-navy">Order Summary</h3>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/70">Plan</span>
                  <span className="font-semibold text-charcoal">EstateVault Attorney, {config.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/70">One-time platform fee</span>
                  <span className="font-semibold text-charcoal">${config.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/70">Monthly fee</span>
                  <span className="font-semibold text-green-600">$0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/70">Recurring fees</span>
                  <span className="font-semibold text-green-600">None</span>
                </div>
                <hr className="border-gray-200" />
                <div className="flex justify-between">
                  <span className="font-bold text-charcoal">Total due today</span>
                  {isPromoFree ? (
                    <span className="text-2xl font-extrabold text-green-600">FREE <span className="text-sm text-charcoal/60 line-through">${config.price.toLocaleString()}</span></span>
                  ) : (
                    <span className="text-2xl font-extrabold text-navy">${config.price.toLocaleString()}</span>
                  )}
                </div>
                {isPromoFree && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 font-medium text-center">
                    ✓ Promotional code TPFP applied, platform fee waived
                  </div>
                )}
              </div>
            </div>

            {/* Account details summary */}
            <div className="mt-6 bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-charcoal/60 uppercase tracking-wider">Account Details</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <span className="text-charcoal/60">Name</span>
                <span className="text-charcoal font-medium">{formData.firstName} {formData.lastName}</span>
                <span className="text-charcoal/60">Email</span>
                <span className="text-charcoal font-medium">{formData.email}</span>
                <span className="text-charcoal/60">Firm</span>
                <span className="text-charcoal font-medium">{formData.firmName || 'N/A'}</span>
                <span className="text-charcoal/60">Bar #</span>
                <span className="text-charcoal font-medium">{formData.barNumber}</span>
                <span className="text-charcoal/60">Review Fee</span>
                <span className="text-charcoal font-medium">${formData.reviewFee}</span>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-shrink-0 px-6 py-4 rounded-lg border border-gray-300 text-charcoal font-medium hover:bg-gray-50 transition-colors"
              >
                &larr; Back
              </button>
              <button
                onClick={handlePayment}
                disabled={submitting}
                className="flex-1 bg-gold hover:bg-gold/90 disabled:opacity-60 disabled:cursor-not-allowed text-navy font-bold text-lg px-6 py-4 rounded-lg transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Redirecting to Stripe...
                  </span>
                ) : (
                  isPromoFree ? 'Create My Account, Free' : 'Secure Payment'
                )}
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-charcoal/60">
              Secured by Stripe. Your payment information is never stored on our servers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttorneySignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f9fafb' }} />}>
      <AttorneySignupContent />
    </Suspense>
  );
}
