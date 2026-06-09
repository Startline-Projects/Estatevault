"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { exchangeResetToken } from "@/lib/api-client/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [linkUsed, setLinkUsed] = useState(false);
  const [done, setDone] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isValid = hasMinLength && hasNumber && passwordsMatch;

  useEffect(() => {
    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      if (tokenHash && type === "recovery") {
        const result = await exchangeResetToken(tokenHash);
        if (result.data) {
          setSessionReady(true);
          return;
        }
        if (result.error === "link_already_used") {
          setLinkUsed(true);
          return;
        }
        setError("This reset link is invalid or has expired. Please request a new one.");
        return;
      }
    }

    bootstrap();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    setDone(true);
    const supabase2 = createClient();
    const { data: { user } } = await supabase2.auth.getUser();
    const role = user?.user_metadata?.role;
    const dest = role === "partner" ? "/pro" : role === "admin" ? "/admin" : "/dashboard";
    setTimeout(() => router.push(dest), 2000);
  }

  if (linkUsed) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="block text-center text-2xl font-bold text-white mb-8">
            EstateVault
          </Link>
          <div className="rounded-2xl bg-white p-8 shadow-xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <span className="text-3xl text-red-500">!</span>
            </div>
            <h1 className="mt-6 text-xl font-bold text-navy">Link Already Used</h1>
            <p className="mt-3 text-sm text-charcoal/60">
              This password reset link has already been used. Each link can only be used once.
            </p>
            <Link
              href="/auth/forgot-password"
              className="mt-6 inline-block rounded-full bg-gold px-6 py-3 text-sm font-semibold text-white hover:bg-gold/90 transition-colors"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="block text-center text-2xl font-bold text-white mb-8">
            EstateVault
          </Link>
          <div className="rounded-2xl bg-white p-8 shadow-xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
              <span className="text-3xl">&#10003;</span>
            </div>
            <h1 className="mt-6 text-xl font-bold text-navy">Password Updated</h1>
            <p className="mt-3 text-sm text-charcoal/60">Redirecting you to your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-2xl font-bold text-white mb-8">
          EstateVault
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="text-xl font-bold text-navy">Set New Password</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Choose a strong password for your account.
          </p>

          {!sessionReady && (
            <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              Loading your session... If this persists, request a new reset link.
            </div>
          )}

          {error && (
            <div role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-navy mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={password.length > 0 && (!hasMinLength || !hasNumber)}
                  aria-describedby="pw-reqs"
                  placeholder="Min 8 characters, 1 number"
                  className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 pr-16 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-charcoal/40 hover:text-charcoal/70"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {password.length > 0 && (
                <div id="pw-reqs" className="mt-2 space-y-1">
                  <p className={`text-xs ${hasMinLength ? "text-green-600" : "text-charcoal/40"}`}>
                    {hasMinLength ? "✓" : "○"} At least 8 characters
                  </p>
                  <p className={`text-xs ${hasNumber ? "text-green-600" : "text-charcoal/40"}`}>
                    {hasNumber ? "✓" : "○"} At least one number
                  </p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-navy mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                  aria-describedby={confirmPassword.length > 0 ? "confirm-msg" : undefined}
                  placeholder="Confirm your password"
                  className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 pr-16 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-charcoal/40 hover:text-charcoal/70"
                >
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p id="confirm-msg" className={`mt-1 text-xs ${passwordsMatch ? "text-green-600" : "text-red-500"}`}>
                  {passwordsMatch ? "✓ Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isValid || loading || !sessionReady}
              className="w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-charcoal/60">
            <Link href="/auth/login" className="font-medium text-navy hover:text-gold transition-colors">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
