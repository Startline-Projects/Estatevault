"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ExistingAccountInfo = {
  fullName: string | null;
  hasWill: boolean;
  hasTrust: boolean;
  hasVault: boolean;
};

type Props = {
  value: string;
  onChange: (email: string) => void;
  onVerifiedChange: (state: { verified: boolean; token: string; email: string }) => void;
  disabled?: boolean;
  placeholder?: string;
  loginHref?: string;
  helperText?: string;
  partnerId?: string | null;
  partnerSlug?: string | null;
};

function randomSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID() + crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function EmailVerifyGate({
  value,
  onChange,
  onVerifiedChange,
  disabled,
  placeholder = "your@email.com",
  loginHref = "/auth/login",
  helperText,
  partnerId,
  partnerSlug,
}: Props) {
  const [stage, setStage] = useState<"idle" | "sending" | "awaiting_click" | "verified">("idle");
  const [verifyError, setVerifyError] = useState("");
  const [existingAccount, setExistingAccount] = useState<ExistingAccountInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const sessionIdRef = useRef<string>("");
  const sentForEmailRef = useRef<string>("");

  const normalizedEmail = value.trim().toLowerCase();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const isVerified = stage === "verified" && verifiedEmail === normalizedEmail;

  // Reset state if user edits email after verifying OR while awaiting click
  useEffect(() => {
    if (stage === "verified" && normalizedEmail !== verifiedEmail) {
      setStage("idle");
      setExistingAccount(null);
      setVerifiedToken("");
      setVerifyError("");
      setShowModal(false);
      onVerifiedChange({ verified: false, token: "", email: "" });
      return;
    }
    if (stage === "awaiting_click" && normalizedEmail !== sentForEmailRef.current) {
      setStage("idle");
      setShowModal(false);
    }
  }, [normalizedEmail, stage, verifiedEmail, onVerifiedChange]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Poll for verification while modal open + awaiting click
  useEffect(() => {
    if (stage !== "awaiting_click" || !showModal) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/auth/check-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            sessionId: sessionIdRef.current,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.verified && data.token) {
          setVerifiedToken(data.token);
          setVerifiedEmail(normalizedEmail);
          setStage("verified");
          setShowModal(false);
          onVerifiedChange({ verified: true, token: data.token, email: normalizedEmail });
          return;
        }
      } catch {
        // ignore transient errors
      }
      if (!cancelled) setTimeout(poll, 3000);
    };

    const handle = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [stage, showModal, normalizedEmail, onVerifiedChange]);

  async function handleVerifyClick() {
    setVerifyError("");
    setExistingAccount(null);
    if (!emailLooksValid) {
      setVerifyError("Enter a valid email address.");
      return;
    }

    setStage("sending");
    try {
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const checkData = await checkRes.json().catch(() => ({}));

      if (!checkRes.ok) {
        setVerifyError(checkData.error || "Unable to check email.");
        setStage("idle");
        return;
      }

      if (checkData.exists) {
        setExistingAccount({
          fullName: checkData.fullName,
          hasWill: !!checkData.hasWill,
          hasTrust: !!checkData.hasTrust,
          hasVault: !!checkData.hasVault,
        });
        setStage("idle");
        return;
      }

      if (!sessionIdRef.current) sessionIdRef.current = randomSessionId();

      const sendRes = await fetch("/api/auth/send-verify-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, sessionId: sessionIdRef.current, partnerId: partnerId || null, partnerSlug: partnerSlug || null }),
      });
      const sendData = await sendRes.json().catch(() => ({}));

      if (!sendRes.ok) {
        setVerifyError(sendData.error || "Unable to send email.");
        setStage("idle");
        return;
      }

      sentForEmailRef.current = normalizedEmail;
      setStage("awaiting_click");
      setShowModal(true);
      setResendCooldown(30);
    } catch {
      setVerifyError("Network error. Try again.");
      setStage("idle");
    }
  }

  async function handleResendLink() {
    if (resendCooldown > 0) return;
    setVerifyError("");
    if (!sessionIdRef.current) sessionIdRef.current = randomSessionId();
    try {
      const res = await fetch("/api/auth/send-verify-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, sessionId: sessionIdRef.current, partnerId: partnerId || null, partnerSlug: partnerSlug || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVerifyError(data.error || "Unable to resend.");
        return;
      }
      setResendCooldown(30);
    } catch {
      setVerifyError("Network error.");
    }
  }

  const inputClass =
    "min-h-[44px] flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold disabled:bg-gray-50";

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isVerified}
          placeholder={placeholder}
          className={inputClass}
        />
        {!isVerified ? (
          <button
            type="button"
            onClick={handleVerifyClick}
            disabled={disabled || !emailLooksValid || stage === "sending" || stage === "awaiting_click"}
            className="shrink-0 min-h-[44px] rounded-lg bg-navy px-4 text-sm font-semibold text-white hover:bg-navy/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {stage === "sending"
              ? "Sending..."
              : stage === "awaiting_click"
              ? "Waiting..."
              : "Verify Email"}
          </button>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 min-h-[44px] rounded-lg bg-green-50 border border-green-200 px-3 text-sm font-semibold text-green-700">
            &#10003; Verified
          </span>
        )}
      </div>

      {helperText && !verifyError && !existingAccount && stage === "idle" && (
        <p className="mt-2 text-xs text-charcoal/50">{helperText}</p>
      )}

      {verifyError && <p className="mt-2 text-xs text-red-600">{verifyError}</p>}

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

      {stage === "awaiting_click" && !showModal && (
        <div className="mt-3 rounded-lg bg-navy/5 border border-navy/10 px-4 py-3 text-sm text-navy flex items-center justify-between gap-3">
          <span>Verification link sent. Click link in email to continue.</span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="shrink-0 text-xs font-semibold text-navy underline hover:text-gold"
          >
            Show details
          </button>
        </div>
      )}

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
              <span className="text-3xl">&#9993;</span>
            </div>
            <h2 className="mt-6 text-lg font-bold text-navy">Verification email sent</h2>
            <p className="mt-3 text-sm text-charcoal/70 leading-relaxed">
              We sent a verification link to <strong>{normalizedEmail}</strong>. Open your inbox and click the link
              to verify, then come back to this tab.
            </p>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-charcoal/50">
              <span className="inline-block h-2 w-2 rounded-full bg-gold animate-pulse" />
              Waiting for verification...
            </div>

            <button
              type="button"
              onClick={handleResendLink}
              disabled={resendCooldown > 0}
              className="mt-6 text-xs font-medium text-navy hover:text-gold transition-colors disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Resend link in ${resendCooldown}s` : "Resend link"}
            </button>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-4 block w-full text-xs text-charcoal/40 hover:text-charcoal/70 transition-colors"
            >
              Hide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
