"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Step = 1 | 2 | 3;

function AffiliateSignupContent() {
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const codeParam = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const incomplete = searchParams.get("incomplete") === "true";

  const initialStep: Step =
    stepParam === "success" && codeParam
      ? 3
      : stepParam === "stripe"
        ? 2
        : 1;

  const [step, setStep] = useState<Step>(initialStep);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(
    errorParam === "stripe_error"
      ? "Stripe verification failed. Please try again."
      : errorParam
        ? "Something went wrong. Please try again."
        : ""
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(codeParam);
  const [copied, setCopied] = useState(false);

  // Restore onboardingUrl from sessionStorage on stripe step (after refresh)
  useEffect(() => {
    if (step === 2 && !onboardingUrl) {
      const stored = sessionStorage.getItem("ev_aff_onboarding_url");
      if (stored) setOnboardingUrl(stored);
    }
  }, [step, onboardingUrl]);

  const referralLink =
    affiliateCode && typeof window !== "undefined"
      ? `${window.location.origin}/a/${affiliateCode}`
      : "";

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName || !email || !password) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptTerms) {
      setError("You must accept the Affiliate Agreement to continue.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/affiliate/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, acceptTerms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");

      setOnboardingUrl(data.onboardingUrl);
      setAffiliateCode(data.code);
      sessionStorage.setItem("ev_aff_onboarding_url", data.onboardingUrl);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-navy">
            EstateVault
          </Link>
          <span className="text-sm text-charcoal/50">Affiliate Program</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-12">
          {[
            { num: 1, label: "Your Account" },
            { num: 2, label: "Payment Setup" },
            { num: 3, label: "Get Your Link" },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step >= (s.num as Step)
                      ? "bg-navy text-white"
                      : "bg-gray-200 text-charcoal/60"
                  }`}
                >
                  {step > (s.num as Step) ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s.num
                  )}
                </div>
                <span className={`text-sm font-medium hidden sm:inline ${step >= (s.num as Step) ? "text-navy" : "text-charcoal/60"}`}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div className={`w-12 h-0.5 ${step > (s.num as Step) ? "bg-navy" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Earnings preview chip */}
        <div className="text-center mb-8">
          <span className="inline-block bg-navy/10 text-navy text-sm font-semibold px-4 py-1.5 rounded-full">
            Earn $100 per Will, $200 per Trust
          </span>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {incomplete && step === 2 && (
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Stripe onboarding wasn&apos;t completed. Click below to finish so we can pay you.
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={handleSignup} className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-navy">Create Your Affiliate Account</h2>
            <p className="mt-2 text-sm text-charcoal/60">
              Free to join. Permanent referral link. Paid via Stripe Connect.
            </p>

            <div className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                  placeholder="jane@example.com"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Password *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy/50 accent-navy"
                />
                <span className="text-sm text-charcoal/70">
                  I agree to the{" "}
                  <a href="/terms" className="text-navy underline underline-offset-2">
                    Affiliate Agreement
                  </a>{" "}
                  and confirm I am at least 18 years old. *
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-8 w-full bg-gold hover:bg-gold/90 disabled:opacity-60 disabled:cursor-not-allowed text-navy font-bold text-lg px-6 py-4 rounded-lg transition-colors"
            >
              {submitting ? "Creating Account..." : "Continue to Payment Setup →"}
            </button>

            <p className="mt-6 text-center text-sm text-charcoal/60">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium text-navy hover:text-gold transition-colors">
                Sign in
              </Link>
            </p>
          </form>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-navy">Connect Your Payout Account</h2>
            <p className="mt-2 text-sm text-charcoal/60">
              Stripe collects your bank info and tax details so we can send commissions automatically.
              Takes about 2 minutes.
            </p>

            <ul className="mt-6 space-y-2 text-sm text-charcoal/70">
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span> Direct deposit to your bank account
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span> Automatic payouts after each conversion
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold mt-0.5">✓</span> 1099 issued at year-end by Stripe
              </li>
            </ul>

            <button
              onClick={() => onboardingUrl && (window.location.href = onboardingUrl)}
              disabled={!onboardingUrl}
              className="mt-8 w-full bg-gold hover:bg-gold/90 disabled:opacity-60 disabled:cursor-not-allowed text-navy font-bold text-lg px-6 py-4 rounded-lg transition-colors"
            >
              Continue to Stripe →
            </button>

            <p className="mt-4 text-center text-xs text-charcoal/60">
              Secured by Stripe. Your information is never stored on our servers.
            </p>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && affiliateCode && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-navy text-center">You&apos;re In</h2>
            <p className="mt-2 text-sm text-charcoal/60 text-center">
              Share this link. Earn on every Will and Trust purchased through it.
            </p>

            <div className="mt-8 bg-navy/5 rounded-xl p-6 border border-navy/10">
              <label className="block text-xs font-semibold text-charcoal/60 uppercase tracking-wider mb-2">
                Your Permanent Referral Link
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-navy font-mono break-all">
                  {referralLink}
                </code>
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 bg-navy hover:bg-navy/90 text-white font-semibold px-4 py-3 rounded-lg transition-colors text-sm"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="mt-3 text-xs text-charcoal/60">
                Code: <span className="font-mono font-semibold text-navy">{affiliateCode}</span> · 90-day cookie attribution
              </p>
            </div>

            <Link
              href="/affiliate"
              className="mt-8 block w-full bg-gold hover:bg-gold/90 text-navy font-bold text-lg px-6 py-4 rounded-lg transition-colors text-center"
            >
              Go to Affiliate Dashboard →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AffiliateSignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f9fafb" }} />}>
      <AffiliateSignupContent />
    </Suspense>
  );
}
