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

    // Get user and check their type from profiles table (source of truth)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Failed to get user after login.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .single();

    const userType = profile?.user_type || "client";

    if (userType === "partner") {
      // Check partner onboarding status
      const { data: partner } = await supabase
        .from("partners")
        .select("onboarding_completed, status")
        .eq("profile_id", user.id)
        .single();

      if (partner?.status === "pending_verification") {
        router.push("/partners/attorneys/welcome");
      } else if (partner?.onboarding_completed) {
        router.push("/pro/dashboard");
      } else {
        router.push("/pro/onboarding/step-1");
      }
    } else if (userType === "sales_rep") {
      router.push("/sales/dashboard");
    } else if (userType === "admin") {
      router.push("/sales/dashboard");
    } else if (userType === "review_attorney") {
      router.push("/attorney");
    } else {
      router.push(redirect);
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <h1 className="text-xl font-bold text-[#1C3557]">Sign In</h1>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#1C3557] mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-[#2D2D2D] focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/30"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[#1C3557] mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-[#2D2D2D] focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/30"
            placeholder="Enter your password"
          />
        </div>

        <div className="flex justify-end">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-[#1C3557]/60 hover:text-[#C9A84C] transition-colors"
          >
            Forgot your password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] rounded-full bg-[#C9A84C] py-3.5 text-sm font-semibold text-white hover:bg-[#C9A84C]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#1C3557] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <p className="text-center text-2xl font-bold text-white mb-8">
          EstateVault
        </p>
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
