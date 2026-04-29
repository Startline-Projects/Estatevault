"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SignUpForm() {
  const searchParams = useSearchParams();
  const partner = searchParams.get("partner") || "";
  const redirect = searchParams.get("redirect") || "/dashboard";
  const isVaultFlow = !!partner && redirect.includes("vault");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    let redirected = false;
    const withTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 20000) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(input, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      const signupRes = await withTimeout("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password, fullName }),
      });
      const signupData = await signupRes.json().catch(() => ({}));

      if (!signupRes.ok) {
        setError(signupData.error || "Failed to create account.");
        return;
      }

      const startVaultCheckout = async () => {
        const res = await withTimeout("/api/checkout/vault-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partner_slug: partner, email: normalizedEmail, full_name: fullName }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.url) {
          redirected = true;
          window.location.href = data.url;
          return;
        }
        setError(data.error || "Failed to start checkout.");
      };

      const supabase = createClient();
      let signInErrorMessage = "Invalid login credentials";
      let signedIn = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (!signInError) {
          signedIn = true;
          break;
        }
        signInErrorMessage = signInError.message;
        if (attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }

      if (!signedIn) {
        const repairRes = await withTimeout("/api/auth/set-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            fullName,
          }),
        });

        const repairData = await repairRes.json().catch(() => ({}));
        if (!repairRes.ok) {
          setError(repairData.error || signInErrorMessage || "Unable to sign in right now.");
          return;
        }

        const { error: repairSignInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (repairSignInError) {
          setError(repairSignInError.message || "Unable to sign in right now.");
          return;
        }
        signedIn = true;
      }

      if (isVaultFlow) {
        await startVaultCheckout();
        return;
      }

      redirected = true;
      window.location.href = redirect;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      if (!redirected) setLoading(false);
    }
  }

  const inputClass = "min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30";

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-2xl font-bold text-white mb-8">
          EstateVault
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="text-xl font-bold text-navy">Create Your Account</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            {isVaultFlow
              ? "Enter your details to get started with your secure vault."
              : "Start protecting your family today."}
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-navy mb-1">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                placeholder="John Smith"
              />
            </div>

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
                className={inputClass}
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
                className={inputClass}
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-navy mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? isVaultFlow ? "Redirecting to Payment..." : "Creating Account..."
                : isVaultFlow ? "Continue to Payment →" : "Create My Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-charcoal/60">
            Already have an account?{" "}
            <Link
              href={`/auth/login${partner ? `?partner=${partner}&redirect=${redirect}` : ""}`}
              className="font-medium text-navy hover:text-gold transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
