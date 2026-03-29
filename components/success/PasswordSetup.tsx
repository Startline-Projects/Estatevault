"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface PasswordSetupProps {
  email: string;
  userId?: string;
}

export default function PasswordSetup({ email, userId }: PasswordSetupProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isValid = hasMinLength && hasNumber && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // If user has a session (auto-created account), update password directly
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const { error: updateErr } = await supabase.auth.updateUser({ password });
        if (updateErr) {
          setError(updateErr.message);
          setLoading(false);
          return;
        }
      } else if (userId) {
        // Sign in with the auto-created account first, then update
        // The webhook created the account — try signing in with the temp/invite flow
        const res = await fetch("/api/auth/set-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to set password");
          setLoading(false);
          return;
        }

        // Sign in with new password
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          setError(signInErr.message);
          setLoading(false);
          return;
        }
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 p-8">
      <h2 className="text-lg font-bold text-white text-center">
        Create your password to access your documents
      </h2>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* Password field */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters, 1 number"
              className="w-full rounded-xl border-2 border-white/20 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder-white/30 focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 text-sm"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {/* Inline validation */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className={`flex items-center gap-2 text-xs ${hasMinLength ? "text-green-400" : "text-white/40"}`}>
                <span>{hasMinLength ? "&#10003;" : "&#9675;"}</span> At least 8 characters
              </div>
              <div className={`flex items-center gap-2 text-xs ${hasNumber ? "text-green-400" : "text-white/40"}`}>
                <span>{hasNumber ? "&#10003;" : "&#9675;"}</span> At least one number
              </div>
            </div>
          )}
        </div>

        {/* Confirm password field */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full rounded-xl border-2 border-white/20 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder-white/30 focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/30"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 text-sm"
            >
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>

          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="mt-1.5 text-xs text-red-400">Passwords do not match</p>
          )}
          {passwordsMatch && (
            <p className="mt-1.5 text-xs text-green-400">&#10003; Passwords match</p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/20 border border-red-400/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full min-h-[48px] rounded-full bg-[#C9A84C] py-3.5 text-base font-semibold text-white hover:bg-[#C9A84C]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {loading ? "Setting up your account..." : "Access My Documents"}
        </button>
      </form>
    </div>
  );
}
