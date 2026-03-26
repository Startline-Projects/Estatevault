"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function VerifyEmailPage() {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    setResending(true);
    const supabase = createClient();

    // Resend requires the user's email — get it from the current session
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user?.email;

    if (email) {
      await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    }

    setResending(false);
    setResent(true);
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-2xl font-bold text-white mb-8">
          EstateVault
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
            <span className="text-3xl">✉</span>
          </div>

          <h1 className="mt-6 text-xl font-bold text-navy">Check Your Email</h1>
          <p className="mt-3 text-sm text-charcoal/60 leading-relaxed">
            We sent you a verification link. Click the link in your email to
            activate your account.
          </p>

          <div className="mt-8">
            {resent ? (
              <p className="text-sm text-green-600 font-medium">
                Verification email resent!
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
