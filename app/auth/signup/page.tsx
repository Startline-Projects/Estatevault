"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkEmail, sendVerifyCode, verifyCode } from "@/lib/api-client/auth";

type ExistingAccountInfo = {
  fullName: string | null;
  hasWill: boolean;
  hasTrust: boolean;
  hasVault: boolean;
};

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

  // Email verification state
  const [verifyStage, setVerifyStage] = useState<"idle" | "code_sent" | "verified">("idle");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [existingAccount, setExistingAccount] = useState<ExistingAccountInfo | null>(null);
  const [code, setCode] = useState("");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailIsVerified = verifyStage === "verified" && verifiedEmail === email.trim().toLowerCase();

  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Reset verification if user changes email after verifying
  useEffect(() => {
    if (verifyStage !== "idle" && email.trim().toLowerCase() !== verifiedEmail) {
      setVerifyStage("idle");
      setExistingAccount(null);
      setCode("");
      setVerifiedToken("");
      setVerifyError("");
    }
  }, [email, verifyStage, verifiedEmail]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleVerifyEmailClick() {
    setVerifyError("");
    setExistingAccount(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!emailLooksValid) {
      setVerifyError("Enter a valid email address.");
      return;
    }

    setVerifyLoading(true);
    try {
      const { data: checkData, error: checkErr } = await checkEmail(normalizedEmail);
      if (checkErr || !checkData) {
        setVerifyError(checkErr || "Unable to check email.");
        return;
      }

      if (checkData.exists) {
        setExistingAccount({
          fullName: checkData.fullName ?? null,
          hasWill: !!checkData.hasWill,
          hasTrust: !!checkData.hasTrust,
          hasVault: !!checkData.hasVault,
        });
        return;
      }

      const { error: sendErr } = await sendVerifyCode(normalizedEmail, partner || undefined);
      if (sendErr) {
        setVerifyError(sendErr);
        return;
      }

      setVerifyStage("code_sent");
      setResendCooldown(30);
    } catch {
      setVerifyError("Network error. Try again.");
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleVerifyCode() {
    setVerifyError("");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (normalizedCode.length !== 6) {
      setVerifyError("Enter the 6-digit code.");
      return;
    }

    setVerifyLoading(true);
    try {
      const { data, error: verifyErr } = await verifyCode(normalizedEmail, normalizedCode);
      if (verifyErr || !data?.token) {
        setVerifyError(verifyErr || "Verification failed.");
        return;
      }

      setVerifiedToken(data.token);
      setVerifiedEmail(normalizedEmail);
      setVerifyStage("verified");
    } catch {
      setVerifyError("Network error. Try again.");
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setVerifyError("");
    const normalizedEmail = email.trim().toLowerCase();
    setVerifyLoading(true);
    try {
      const { error: sendErr } = await sendVerifyCode(normalizedEmail, partner || undefined);
      if (sendErr) {
        setVerifyError(sendErr);
        return;
      }
      setResendCooldown(30);
    } catch {
      setVerifyError("Network error.");
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!emailIsVerified) {
      setError("Please verify your email before continuing.");
      return;
    }
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
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          fullName,
          verifiedToken,
          partnerSlug: partner || null,
        }),
      });
      const signupData = await signupRes.json().catch(() => ({}));

      if (!signupRes.ok) {
        setError(signupData.error || "Failed to create account.");
        return;
      }

      const supabase = createClient();
      for (let attempt = 0; attempt < 5; attempt++) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (!signInError) break;
        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 600));
      }

      if (isVaultFlow) {
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
  const loginHref = `/auth/login${partner ? `?partner=${partner}&redirect=${encodeURIComponent(redirect)}` : ""}`;

  const submitDisabled =
    loading ||
    !emailIsVerified ||
    !fullName.trim() ||
    password.length < 8 ||
    password !== confirmPassword;

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
            <div role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
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
                maxLength={100}
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
              <div className="flex gap-2">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={emailIsVerified}
                  className={`${inputClass} flex-1 ${emailIsVerified ? "bg-gray-50" : ""}`}
                  placeholder="john@example.com"
                />
                {!emailIsVerified ? (
                  <button
                    type="button"
                    onClick={handleVerifyEmailClick}
                    disabled={!emailLooksValid || verifyLoading || verifyStage === "code_sent"}
                    className="shrink-0 min-h-[44px] rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifyLoading && verifyStage === "idle" ? "..." : "Verify Email"}
                  </button>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 min-h-[44px] rounded-xl bg-green-50 border border-green-200 px-3 text-sm font-semibold text-green-700">
                    &#10003; Verified
                  </span>
                )}
              </div>

              {verifyError && (
                <p role="alert" className="mt-2 text-xs text-red-600">{verifyError}</p>
              )}

              {existingAccount && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">An account already exists for this email.</p>
                  <p className="mt-1 text-xs text-amber-800/80">
                    {existingAccount.fullName ? `${existingAccount.fullName} already has ` : "We already have "}
                    {[
                      existingAccount.hasWill && "Will documents",
                      existingAccount.hasTrust && "Trust documents",
                      existingAccount.hasVault && "an active Vault subscription",
                    ]
                      .filter(Boolean)
                      .join(", ") || "an account"}
                    {" on file. "}
                    <Link href={loginHref} className="underline font-medium text-amber-900 hover:text-navy">
                      Sign in instead
                    </Link>
                    {" or use a different email."}
                  </p>
                </div>
              )}

              {verifyStage === "code_sent" && (
                <div className="mt-3 rounded-lg bg-navy/5 border border-navy/10 px-4 py-3">
                  <p className="text-xs text-navy">
                    We sent a 6-digit code to <strong>{email.trim().toLowerCase()}</strong>. Enter it below.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className={`${inputClass} flex-1 tracking-[0.4em] text-center font-mono`}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={verifyLoading || code.length !== 6}
                      className="shrink-0 min-h-[44px] rounded-xl bg-gold px-4 text-sm font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyLoading ? "..." : "Confirm"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || verifyLoading}
                    className="mt-2 text-xs font-medium text-navy hover:text-gold transition-colors disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              )}
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
                aria-describedby="password-reqs"
                className={inputClass}
                placeholder="Min. 8 characters"
              />
              {password.length > 0 && (
                <div id="password-reqs" className="mt-2 space-y-1">
                  <p className={`text-xs ${hasMinLength ? "text-green-600" : "text-charcoal/40"}`}>
                    {hasMinLength ? "✓" : "○"} At least 8 characters
                  </p>
                  <p className={`text-xs ${hasNumber ? "text-green-600" : "text-charcoal/40"}`}>
                    {hasNumber ? "✓" : "○"} At least one number
                  </p>
                </div>
              )}
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
                aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                aria-describedby={confirmPassword.length > 0 ? "confirm-msg" : undefined}
                className={inputClass}
                placeholder="Re-enter your password"
              />
              {confirmPassword.length > 0 && (
                <p id="confirm-msg" className={`mt-1 text-xs ${passwordsMatch ? "text-green-600" : "text-red-500"}`}>
                  {passwordsMatch ? "✓ Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>

            {!emailIsVerified && (
              <p className="text-xs text-charcoal/60">
                Verify your email before {isVaultFlow ? "continuing to payment" : "creating your account"}.
              </p>
            )}

            <button
              type="submit"
              disabled={submitDisabled}
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
              href={loginHref}
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
