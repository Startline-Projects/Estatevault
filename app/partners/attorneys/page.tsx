'use client';

import { useState } from 'react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STANDARD_FEATURES = [
  'Unlimited document generation',
  'Branded client-facing platform',
  'Reviewing attorney role on all documents',
  'Set your own review fee ($150-$1,500)',
  'You earn $300/will + your review fee',
  'You earn $400/trust + your review fee',
  'Attorney badge on client portal',
  'Direct contact info shown to clients for upsells',
  'White-labeled marketing materials (flyers, emails, social posts — all branded for your firm)',
  'Marketing training and approved client scripts included',
  '3 team seats included',
  'Email & chat support',
];

const PROFESSIONAL_FEATURES = [
  'Everything in Standard, plus:',
  'You earn $350/will + your review fee',
  'You earn $500/trust + your review fee',
  '10 team seats included',
  'Commission hierarchy for associates',
  'Priority placement in EstateVault\'s attorney referral network',
  'Dedicated onboarding specialist',
];

const ENTERPRISE_FEATURES = [
  'Everything in Professional, plus:',
  'Custom pricing structure',
  'Multi-firm / multi-location support',
  'Custom integrations (CRM, case management)',
  'Dedicated account manager',
  'SLA guarantees',
  'White-glove onboarding & training',
  'Unlimited seats',
];

const REFERRAL_FEATURES = [
  'Send clients to EstateVault, earn per completion',
  'Receive flagged complex cases from the platform',
  'No platform fee, no commitment',
  'Track referrals from your dashboard',
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function AttorneyPartnerPage() {
  const [calcTier, setCalcTier] = useState<'standard' | 'professional'>('standard');
  const [calcVolume, setCalcVolume] = useState(5);
  const [calcReviewFee, setCalcReviewFee] = useState(300);
  const [demoTab, setDemoTab] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);

  const isPromoValid = promoCode.trim().toUpperCase() === 'TPFP';
  const promoActive = promoApplied && isPromoValid;

  const trustSplit = calcTier === 'standard' ? 400 : 500;
  const evKeeps = calcTier === 'standard' ? 200 : 150;
  const platformFee = promoActive ? 0 : (calcTier === 'standard' ? 1200 : 6000);
  const trustEarnings = trustSplit * calcVolume;
  const reviewEarnings = calcReviewFee > 0 ? calcReviewFee * calcVolume : 0;
  const totalMonthly = trustEarnings + reviewEarnings;
  const paybackMonths = totalMonthly > 0 ? platformFee / totalMonthly : Infinity;
  const paybackText = paybackMonths < 1 ? 'less than 1 month' : paybackMonths <= 1 ? '1 month' : `${Math.ceil(paybackMonths * 2) / 2} months`;

  function scrollToPricing() {
    document.getElementById('pricing-cards')?.scrollIntoView({ behavior: 'smooth' });
  }

  const demoTabs = ['1. Quiz', '2. Results', '3. Documents', '4. The Vault', '5. Your Review'] as const;

  /* ---------- render ---------- */

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ============================================================ */}
      {/*  HEADER BAR                                                   */}
      {/* ============================================================ */}
      <header className="bg-navy px-6" style={{ height: 56 }}>
        <div className="mx-auto max-w-6xl h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">EstateVault</span>
            <span className="text-xs font-bold text-gold bg-gold/15 px-2 py-0.5 rounded">Pro</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/partners/attorneys/review-network"
              className="text-gold font-semibold hover:text-gold/80 transition-colors whitespace-nowrap"
            >
              Become a Review Attorney
            </Link>
            <span className="text-white/20 hidden md:inline">|</span>
            <span className="text-white/50 text-xs hidden md:inline">
              support@estatevault.us
            </span>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  SECTION 1 — HERO                                            */}
      {/* ============================================================ */}
      <section className="bg-navy text-white py-20 md:py-28 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Stop Competing With DIY.{' '}
            <span className="text-gold">Build Your Own.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            LegalZoom is taking your clients. EstateVault lets you offer the same
            automated experience&nbsp;&mdash;&nbsp;under your name, at your price,
            with your legal oversight. You become the DIY option in your market.
          </p>
          <button
            onClick={scrollToPricing}
            className="mt-10 inline-block bg-gold hover:bg-gold/90 text-navy font-bold text-lg px-10 py-4 rounded-lg transition-colors"
          >
            Get Started — Choose Your Plan
          </button>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECTION 2 — HOW IT WORKS                                    */}
      {/* ============================================================ */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold text-navy text-center">
            Your workflow. Simplified.
          </h2>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-10">
            {[
              {
                step: 1,
                title: 'Client completes the intake',
                desc: '15-minute questionnaire covers everything you need. No paralegal time required.',
              },
              {
                step: 2,
                title: 'AI drafts the documents',
                desc: 'Attorney-quality Michigan documents based on EPIC, generated in minutes.',
              },
              {
                step: 3,
                title: 'You review and approve',
                desc: 'Your name, your bar number on delivery. You set your own review fee.',
              },
              {
                step: 4,
                title: 'Complex cases become full engagements',
                desc: 'Irrevocable trusts, Medicaid planning, business succession — flagged directly to you.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gold text-navy flex items-center justify-center text-lg font-bold">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">{item.title}</h3>
                  <p className="mt-1 text-charcoal/70 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CLIENT EXPERIENCE WALKTHROUGH                               */}
      {/* ============================================================ */}
      <section className="py-20 px-6 bg-white">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-navy text-center">
            See exactly what your clients experience.
          </h2>
          <p className="mt-4 text-gray-500 text-center max-w-2xl mx-auto">
            This is the platform they use. Professional, simple, and branded with your firm&apos;s name and logo.
          </p>

          {/* Tabs */}
          <div className="mt-12 flex justify-center gap-1 md:gap-2 overflow-x-auto">
            {demoTabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setDemoTab(i)}
                className={`px-3 md:px-5 py-2 text-xs md:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  demoTab === i ? 'text-navy border-gold' : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Browser mockup */}
          <div className="mt-6 rounded-xl shadow-xl overflow-hidden border border-gray-200">
            {/* Chrome bar */}
            <div className="bg-navy px-4 py-3 flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white/10 rounded-md px-3 py-1 text-xs text-white/60">
                legacy.yourfirm.com
              </div>
            </div>

            {/* Content area */}
            <div className="bg-white min-h-[320px] md:min-h-[380px] flex items-center justify-center p-6 md:p-10">

              {/* Tab 1 — Quiz */}
              {demoTab === 0 && (
                <div className="w-full max-w-md">
                  <div className="bg-navy/5 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="text-xs text-gray-400 font-medium">Step 3 of 10</div>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full"><div className="w-[30%] h-full bg-gold rounded-full" /></div>
                    </div>
                    <p className="font-semibold text-navy text-lg mb-4">Do you own real estate in Michigan?</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border-2 border-gray-200 rounded-lg py-3 text-center font-semibold text-gray-600 cursor-default">Yes</div>
                      <div className="border-2 border-gray-200 rounded-lg py-3 text-center font-semibold text-gray-600 cursor-default">No</div>
                    </div>
                    <div className="mt-4 bg-gray-200 text-gray-400 rounded-lg py-3 text-center font-semibold text-sm">Continue →</div>
                  </div>
                </div>
              )}

              {/* Tab 2 — Results */}
              {demoTab === 1 && (
                <div className="w-full max-w-md text-center">
                  <p className="text-lg font-bold text-navy">Based on your answers, a Trust Package fits your situation.</p>
                  <ul className="mt-4 text-left text-sm text-gray-600 space-y-2 max-w-xs mx-auto">
                    <li className="flex gap-2"><span className="text-gold">✓</span> You own real estate in Michigan</li>
                    <li className="flex gap-2"><span className="text-gold">✓</span> You have minor children</li>
                    <li className="flex gap-2"><span className="text-gold">✓</span> Privacy is important to you</li>
                  </ul>
                  <div className="mt-6 border border-gray-200 rounded-lg p-4">
                    <p className="font-bold text-navy">Trust Package</p>
                    <p className="text-2xl font-extrabold text-navy mt-1">$600</p>
                  </div>
                  <div className="mt-4 bg-gold text-white rounded-lg py-3 text-center font-semibold text-sm">Get Started</div>
                </div>
              )}

              {/* Tab 3 — Documents */}
              {demoTab === 2 && (
                <div className="w-full max-w-md">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-green-600 text-xl">✓</span></div>
                    <p className="text-lg font-bold text-navy">Your Trust Package is ready.</p>
                  </div>
                  <div className="space-y-3">
                    {['Revocable Living Trust', 'Pour-Over Will', 'Durable Power of Attorney', 'Patient Advocate Designation'].map(d => (
                      <div key={d} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2"><span className="text-green-500">✅</span><span className="text-sm font-medium text-navy">{d}</span></div>
                        <span className="text-xs text-gold font-semibold">Download</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 4 — Vault */}
              {demoTab === 3 && (
                <div className="w-full max-w-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { icon: '📄', name: 'Estate Documents', count: '1 item' },
                      { icon: '🏦', name: 'Financial Accounts', count: '' },
                      { icon: '🛡', name: 'Insurance Policies', count: '' },
                      { icon: '🔑', name: 'Digital Accounts', count: '' },
                      { icon: '📍', name: 'Physical Locations', count: '' },
                      { icon: '👤', name: 'Important Contacts', count: '' },
                      { icon: '💼', name: 'Business Interests', count: '' },
                      { icon: '📝', name: 'Final Wishes', count: '' },
                    ].map(c => (
                      <div key={c.name} className={`rounded-lg p-3 text-center ${c.count ? 'bg-navy text-white' : 'bg-navy/5 text-navy'}`}>
                        <span className="text-xl">{c.icon}</span>
                        <p className="text-xs font-semibold mt-1">{c.name}</p>
                        <p className="text-[10px] mt-0.5 opacity-60">{c.count || 'Empty'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 5 — Your Review */}
              {demoTab === 4 && (
                <div className="w-full max-w-lg">
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 grid grid-cols-4 gap-2">
                      <span>Client</span><span>Package</span><span>Status</span><span></span>
                    </div>
                    <div className="px-4 py-4 grid grid-cols-4 gap-2 items-center">
                      <span className="text-sm font-medium text-navy">Sarah M.</span>
                      <span className="text-sm text-gray-600">Trust Package</span>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-semibold">Awaiting Review</span>
                      <button className="text-xs bg-gold text-white px-3 py-1.5 rounded font-semibold">Review</button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400 text-center">SLA: 36 hours remaining</p>
                </div>
              )}
            </div>
          </div>

          {/* Caption */}
          <p className="mt-4 text-sm text-gray-500 text-center">
            {demoTab === 0 && 'Clients answer simple questions in plain English. No legal knowledge required. Takes 5 minutes.'}
            {demoTab === 1 && 'Clients receive a personalized recommendation based on their answers. Clear, simple, no jargon.'}
            {demoTab === 2 && 'Attorney-reviewed documents generated instantly after payment. Delivered to their inbox automatically.'}
            {demoTab === 3 && 'Clients store everything their family needs in one secure encrypted vault. They never lose their documents.'}
            {demoTab === 4 && 'Documents come to your review queue. You review, approve, and your name goes on the delivery. You set your own review fee.'}
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECTION 3 — PRICING CARDS                                   */}
      {/* ============================================================ */}
      <section id="pricing-cards" className="py-20 px-6 bg-gray-50">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl md:text-4xl font-bold text-navy text-center">
            Choose your plan.
          </h2>
          <p className="mt-4 text-center text-charcoal/60 text-lg max-w-2xl mx-auto">
            One-time platform fee. No monthly charges. No renewal fees.
          </p>

          {/* Promo code input */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
              <input
                type="text"
                placeholder="Promotional code"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value); setPromoApplied(false); }}
                className="px-4 py-2.5 text-sm outline-none w-44"
              />
              <button
                onClick={() => setPromoApplied(true)}
                className="px-4 py-2.5 bg-navy text-white text-sm font-semibold hover:bg-navy/90 transition-colors"
              >
                Apply
              </button>
            </div>
            {promoApplied && isPromoValid && (
              <span className="text-green-600 text-sm font-semibold flex items-center gap-1">
                ✓ Code applied — platform fee waived!
              </span>
            )}
            {promoApplied && !isPromoValid && promoCode.trim() !== '' && (
              <span className="text-red-500 text-sm font-semibold">
                Invalid code
              </span>
            )}
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* CARD 1 — Standard */}
            <div className="rounded-2xl border border-gray-200 p-8 bg-white shadow-sm flex flex-col">
              <h3 className="text-2xl font-bold text-navy">Standard</h3>
              <div className="mt-4">
                {promoActive ? (
                  <>
                    <span className="text-4xl font-extrabold text-green-600">FREE</span>
                    <span className="text-charcoal/40 text-sm ml-2 line-through">$1,200</span>
                  </>
                ) : (
                  <>
                    <span className="text-4xl font-extrabold text-charcoal">$1,200</span>
                    <span className="text-charcoal/50 text-sm ml-2">one-time</span>
                  </>
                )}
              </div>
              <ul className="mt-8 space-y-3 flex-1">
                {STANDARD_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-charcoal/80">
                    <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/partners/attorneys/signup?tier=standard${promoActive ? '&promo=TPFP' : ''}`}
                className="mt-8 block w-full text-center bg-gold hover:bg-gold/90 text-navy font-bold text-lg px-6 py-4 rounded-lg transition-colors"
              >
                {promoActive ? 'Get Started — Free' : 'Get Started — $1,200'}
              </Link>
            </div>

            {/* CARD 2 — Professional */}
            <div className="relative rounded-2xl border-2 border-gold p-8 bg-white shadow-lg flex flex-col">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gold text-navy text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                Most Popular
              </span>
              <h3 className="text-2xl font-bold text-navy">Professional</h3>
              <div className="mt-4">
                {promoActive ? (
                  <>
                    <span className="text-4xl font-extrabold text-green-600">FREE</span>
                    <span className="text-charcoal/40 text-sm ml-2 line-through">$6,000</span>
                  </>
                ) : (
                  <>
                    <span className="text-4xl font-extrabold text-charcoal">$6,000</span>
                    <span className="text-charcoal/50 text-sm ml-2">one-time</span>
                  </>
                )}
              </div>
              <ul className="mt-8 space-y-3 flex-1">
                {PROFESSIONAL_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-charcoal/80">
                    <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/partners/attorneys/signup?tier=professional${promoActive ? '&promo=TPFP' : ''}`}
                className="mt-8 block w-full text-center bg-navy hover:bg-navy/90 text-white font-bold text-lg px-6 py-4 rounded-lg transition-colors"
              >
                {promoActive ? 'Get Started — Free' : 'Get Started — $6,000'}
              </Link>
            </div>

            {/* CARD 3 — Enterprise */}
            <div className="rounded-2xl border border-gray-200 p-8 bg-white shadow-sm flex flex-col">
              <h3 className="text-2xl font-bold text-navy">Enterprise</h3>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-charcoal">Custom</span>
                <span className="text-charcoal/50 text-sm ml-2">pricing</span>
              </div>
              <ul className="mt-8 space-y-3 flex-1">
                {ENTERPRISE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-charcoal/80">
                    <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:support@estatevault.us?subject=Enterprise%20Attorney%20Partnership%20Inquiry"
                className="mt-8 block w-full text-center border-2 border-navy text-navy hover:bg-navy hover:text-white font-bold text-lg px-6 py-4 rounded-lg transition-colors"
              >
                Talk to Sales
              </a>
            </div>
          </div>

          {/* Note below pricing cards */}
          <p className="text-center text-sm text-gray-500 mt-8">
            All plans include your custom white-label URL: legacy.yourfirmname.com
          </p>

          {/* Referral Partner card */}
          <div className="mt-10 rounded-xl bg-gray-50 border border-gray-200 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-navy">
                Just want to send and receive referrals?{' '}
                <span className="text-gold">Become a Referral Partner — free.</span>
              </h3>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REFERRAL_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-charcoal/70">
                    <svg className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex-shrink-0 text-gold font-semibold hover:text-gold/80 underline underline-offset-4 transition-colors"
            >
              Learn more
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECTION 4 — EARNINGS CALCULATOR (trusts only)               */}
      {/* ============================================================ */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-navy text-center">
            See exactly what you earn.
          </h2>

          <div className="mt-12 bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            {/* Package toggle */}
            <div className="grid grid-cols-2 border-b border-gray-200">
              <button
                onClick={() => setCalcTier('standard')}
                className={`py-4 text-center font-semibold text-sm transition-colors ${
                  calcTier === 'standard'
                    ? 'bg-navy text-white border-b-2 border-gold'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                Standard — $1,200 one-time
              </button>
              <button
                onClick={() => setCalcTier('professional')}
                className={`py-4 text-center font-semibold text-sm transition-colors ${
                  calcTier === 'professional'
                    ? 'bg-navy text-white border-b-2 border-gold'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                Professional — $6,000 one-time
              </button>
            </div>

            {/* Sliders */}
            <div className="p-8 md:p-10 space-y-10">
              {/* Volume slider */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-sm font-semibold text-charcoal/60 uppercase tracking-wider">
                    Trust packages per month
                  </label>
                  <span className="text-3xl font-bold text-navy">{calcVolume}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={calcVolume}
                  onChange={(e) => setCalcVolume(parseInt(e.target.value, 10))}
                  className="w-full accent-gold"
                />
                <div className="flex justify-between text-xs text-charcoal/40 mt-1">
                  <span>1</span>
                  <span>30</span>
                </div>
              </div>

              {/* Review fee slider */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="text-sm font-semibold text-charcoal/60 uppercase tracking-wider">
                    Your attorney review fee (optional)
                  </label>
                  <span className="text-3xl font-bold text-navy">${calcReviewFee}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1500}
                  step={25}
                  value={calcReviewFee}
                  onChange={(e) => setCalcReviewFee(parseInt(e.target.value, 10))}
                  className="w-full accent-gold"
                />
                <div className="flex justify-between text-xs text-charcoal/40 mt-1">
                  <span>$0</span>
                  <span>$1,500</span>
                </div>
                <p className="text-xs text-charcoal/40 mt-1">
                  Set to $0 if you don&apos;t want to offer attorney review
                </p>
              </div>
            </div>

            {/* Result bars */}
            <div className="space-y-0">
              {/* Trust package bar */}
              <div className="bg-navy/5 px-8 py-5 flex items-center justify-between border-t border-gray-100">
                <div>
                  <p className="font-semibold text-navy">
                    Trust Package × {calcVolume} client{calcVolume !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-charcoal/50 mt-1">
                    ${trustSplit} per trust package
                  </p>
                </div>
                <p className="text-2xl font-bold text-navy">
                  ${trustEarnings.toLocaleString()}
                </p>
              </div>

              {/* Review fee bar — only shows if > $0 */}
              {calcReviewFee > 0 && (
                <div className="bg-gold/10 px-8 py-5 flex items-center justify-between border-t border-gold/20">
                  <div>
                    <p className="font-semibold text-gold">
                      Add Attorney Review × {calcVolume} client{calcVolume !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-charcoal/50 mt-1">
                      +${calcReviewFee} per trust — goes 100% to you, EstateVault keeps $0
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-gold">
                    +${reviewEarnings.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Total box */}
            <div className="bg-navy px-8 py-8 text-center text-white">
              <p className="text-4xl md:text-5xl font-bold">
                ${totalMonthly.toLocaleString()}
              </p>
              <p className="text-sm text-gray-300 mt-1">/month</p>

              <div className="mt-4 space-y-1 text-sm text-gray-300">
                <p>Without review: ${trustEarnings.toLocaleString()}/month</p>
                {calcReviewFee > 0 && (
                  <p>With review: ${totalMonthly.toLocaleString()}/month</p>
                )}
              </div>

              <p className="mt-4 text-gold text-sm font-semibold">
                At this rate, your platform pays for itself in {paybackText}.
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="mt-6 text-xs text-charcoal/40 text-center leading-relaxed max-w-2xl mx-auto">
            Earnings shown are estimates based on your selected volume and review fee.
            Attorney review fees are set by you and must comply with applicable bar rules
            on reasonableness of fees. EstateVault does not set, approve, or regulate attorney review fees.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECTION 5 — THE UPSELL OPPORTUNITY                         */}
      {/* ============================================================ */}
      <section className="py-20 px-6 bg-navy text-white">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            The cases that need more come straight to you.
          </h2>
          <p className="mt-6 text-gray-300 text-center max-w-3xl mx-auto leading-relaxed">
            When a client&apos;s situation involves irrevocable trusts, special needs planning,
            Medicaid asset protection, or business succession&nbsp;&mdash;&nbsp;the platform
            flags the case and routes it directly to you for a full engagement.
          </p>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { label: 'Irrevocable Trust', avg: '$3,500 - $7,500', sub: 'avg. engagement fee' },
              { label: 'Special Needs Trust', avg: '$4,000 - $8,000', sub: 'avg. engagement fee' },
              { label: 'Medicaid Planning', avg: '$5,000 - $10,000', sub: 'avg. engagement fee' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 rounded-xl p-8 border border-white/10">
                <p className="text-sm font-semibold text-gold uppercase tracking-wider">{stat.label}</p>
                <p className="mt-3 text-2xl md:text-3xl font-bold">{stat.avg}</p>
                <p className="mt-1 text-sm text-gray-400">{stat.sub}</p>
              </div>
            ))}
          </div>

          <p className="mt-12 text-center text-lg text-gray-300 max-w-2xl mx-auto">
            These are not referrals. These are{' '}
            <span className="text-white font-semibold">your clients</span>, coming to you.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECTION 6 — COMPLIANCE                                      */}
      {/* ============================================================ */}
      <section className="py-12 px-6 bg-gray-100 border-y border-gray-200">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-xl font-bold text-navy">Built with attorneys, for attorneys.</h2>
          <p className="mt-4 text-sm text-charcoal/60 leading-relaxed max-w-2xl mx-auto">
            All document templates were developed in collaboration with Michigan-licensed
            attorneys with over 40 years of combined estate planning experience. You remain
            the professional of record on every engagement. EstateVault is a document
            preparation tool&nbsp;&mdash;&nbsp;not a law firm and not a substitute for legal counsel.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECTION 7 — CONTACT / ENTERPRISE FORM                      */}
      {/* ============================================================ */}
      <section id="contact-form" className="py-20 px-6 bg-navy">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Questions? Let&apos;s talk.
          </h2>
          <p className="mt-4 text-gray-300">
            For Enterprise pricing, referral partnerships, or general questions — reach out and we&apos;ll get back to you within one business day.
          </p>
          <a
            href="mailto:support@estatevault.us"
            className="mt-8 inline-block bg-gold hover:bg-gold/90 text-navy font-bold text-lg px-10 py-4 rounded-lg transition-colors"
          >
            Email support@estatevault.us
          </a>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                       */}
      {/* ============================================================ */}
      <footer className="bg-navy py-8 px-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            &copy; 2025 EstateVault Technologies LLC | EstateVault is a document preparation platform. Professionals using this platform facilitate document preparation only and do not provide legal advice through this platform. Partners are responsible for compliance with their state bar&apos;s rules of professional conduct.
          </p>
        </div>
      </footer>
    </div>
  );
}
