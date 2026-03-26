"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <h1 className="text-xl font-bold text-navy">Sign In</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Welcome back. Sign in to your account.
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-navy mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
            placeholder="john@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-navy mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
            placeholder="Enter your password"
          />
        </div>

        <div className="flex justify-end">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-navy/60 hover:text-gold transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-charcoal/60">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="font-medium text-navy hover:text-gold transition-colors">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-2xl font-bold text-white mb-8">
          EstateVault
        </Link>
        <Suspense fallback={
          <div className="rounded-2xl bg-white p-8 shadow-xl animate-pulse">
            <div className="h-6 w-24 bg-gray-200 rounded" />
            <div className="mt-6 space-y-4">
              <div className="h-11 bg-gray-100 rounded-xl" />
              <div className="h-11 bg-gray-100 rounded-xl" />
            </div>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
