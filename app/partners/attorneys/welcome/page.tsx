'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VerifyResult {
  success: boolean;
  tier: string;
  amount: number;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function AttorneyWelcomeContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const promoParam = searchParams.get('promo');
  const tierParam = searchParams.get('tier');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Promo code flow, account already created, no Stripe session to verify
    if (promoParam?.toUpperCase() === 'TPFP') {
      setResult({
        success: true,
        tier: tierParam || 'standard',
        amount: 0,
      });
      setStatus('success');
      return;
    }

    if (!sessionId) {
      setStatus('error');
      setError('No session ID provided.');
      return;
    }

    async function verify() {
      try {
        // Retrieve password from sessionStorage (stored before Stripe redirect)
        const storedPassword = sessionStorage.getItem("ev_attorney_pwd") || "";
        sessionStorage.removeItem("ev_attorney_pwd");

        const res = await fetch('/api/checkout/attorney/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, password: storedPassword }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Verification failed.');
        }

        setResult(data);
        setStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setStatus('error');
      }
    }

    verify();
  }, [sessionId, promoParam, tierParam]);

  /* ---------- render ---------- */

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-navy">
            EstateVault
          </Link>
          <span className="text-sm text-charcoal/50">Attorney Partner</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-16">
        {/* Loading state */}
        {status === 'loading' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-navy/10 mb-6">
              <svg className="animate-spin h-8 w-8 text-navy" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-navy">Verifying your payment...</p>
            <p className="mt-2 text-sm text-charcoal/60">This will only take a moment.</p>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-charcoal">Something went wrong</p>
            <p className="mt-3 text-charcoal/60">{error}</p>
            <Link
              href="/partners/attorneys"
              className="mt-8 inline-block bg-navy hover:bg-navy/90 text-white font-bold px-8 py-3 rounded-lg transition-colors"
            >
              Return to Attorney Partners
            </Link>
          </div>
        )}

        {/* Success state */}
        {status === 'success' && result && (
          <div>
            {/* Checkmark animation */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6 animate-bounce">
                <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-navy">
                You&apos;re in. Almost.
              </h1>
              <p className="mt-3 text-lg text-charcoal/60">
                Your payment is confirmed. We&apos;re setting up your account now.
              </p>
            </div>

            {/* Status panel */}
            <div className="mt-12 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <h2 className="text-lg font-bold text-navy mb-6">Account Status</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-green-500 text-xl">&#10003;</span>
                  <span className="text-charcoal font-medium">Payment confirmed, ${result.amount?.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-500 text-xl">&#10003;</span>
                  <span className="text-charcoal font-medium">Account created</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-yellow-500 text-xl">&#9203;</span>
                  <span className="text-charcoal font-medium">Bar verification in progress</span>
                  <span className="text-xs text-charcoal/60 ml-auto">24-48 hours</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 text-xl">&#9634;</span>
                  <span className="text-charcoal/50 font-medium">Platform activated</span>
                  <span className="text-xs text-charcoal/60 ml-auto">After bar verification</span>
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="mt-6 bg-navy/5 rounded-xl p-6 border border-navy/10">
              <p className="text-sm text-charcoal/70 leading-relaxed">
                <strong className="text-navy">What happens next?</strong> Our team is verifying your Michigan bar number with the State Bar. This typically takes 24-48 business hours. Once verified, you&apos;ll receive an email with your login credentials and full platform access.
              </p>
            </div>

            {/* Action cards */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:border-gold transition-colors">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/10 mb-4">
                  <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="font-bold text-navy text-sm">Start Training</h3>
                <p className="mt-1 text-xs text-charcoal/50">Learn how the platform works</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:border-gold transition-colors">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/10 mb-4">
                  <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="font-bold text-navy text-sm">Set Up Profile</h3>
                <p className="mt-1 text-xs text-charcoal/50">Complete your attorney profile</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:border-gold transition-colors">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/10 mb-4">
                  <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <h3 className="font-bold text-navy text-sm">Download Toolkit</h3>
                <p className="mt-1 text-xs text-charcoal/50">Marketing materials & guides</p>
              </div>
            </div>

            {/* Support note */}
            <p className="mt-10 text-center text-sm text-charcoal/50">
              Questions? Email us at{' '}
              <a href="mailto:support@estatevault.us" className="text-navy underline underline-offset-2">
                support@estatevault.us
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttorneyWelcomePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f9fafb' }} />}>
      <AttorneyWelcomeContent />
    </Suspense>
  );
}
