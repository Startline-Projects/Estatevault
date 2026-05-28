"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resendVerification } from "@/lib/api-client/auth";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailFromQuery);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

  async function handleResend() {
    setError("");
    if (!email) {
      setError("Enter your email address to resend the verification link.");
      return;
    }

    setResending(true);
    try {
      const { error: resendErr } = await resendVerification(email.trim().toLowerCase());
      if (resendErr) {
        setError(resendErr);
      } else {
        setResent(true);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-2xl font-bold text-white mb-8">
          EstateVault
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
            <span className="text-3xl">&#9993;</span>
          </div>

          <h1 className="mt-6 text-xl font-bold text-navy">Check Your Email</h1>
          <p className="mt-3 text-sm text-charcoal/60 leading-relaxed">
            {emailFromQuery
              ? <>We sent a verification link to <strong>{emailFromQuery}</strong>. Click the link in your email to activate your account.</>
              : "We sent you a verification link. Click the link in your email to activate your account."}
          </p>

          {!emailFromQuery && (
            <div className="mt-6 text-left">
              <label htmlFor="email" className="block text-sm font-medium text-navy mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
                placeholder="you@example.com"
              />
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8">
            {resent ? (
              <p className="text-sm text-green-600 font-medium">
                Verification email resent. Check your inbox.
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm font-medium text-navy hover:text-gold transition-colors disabled:opacity-50"
              >
                {resending ? "Resending..." : "Resend verification email"}
              </button>
            )}
          </div>

          <Link
            href="/auth/login"
            className="mt-6 inline-block text-sm text-charcoal/60 hover:text-navy transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
