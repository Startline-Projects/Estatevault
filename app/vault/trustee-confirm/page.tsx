"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type State = "loading" | "success" | "already" | "error";

export default function TrusteeConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <TrusteeConfirmInner />
    </Suspense>
  );
}

function TrusteeConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!token) { setState("error"); return; }

    fetch("/api/vault/trustees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.alreadyConfirmed) setState("already");
        else if (d.success) setState("success");
        else setState("error");
      })
      .catch(() => setState("error"));
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gold font-bold text-lg tracking-wide mb-6">EstateVault</p>

        {state === "loading" && (
          <p className="text-charcoal/60 text-sm">Confirming your role…</p>
        )}

        {state === "success" && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-navy">Role Confirmed</h1>
            <p className="mt-3 text-sm text-charcoal/60 leading-relaxed">
              You have accepted the role of Vault Trustee. If the vault owner passes or becomes incapacitated, you may request emergency access through EstateVault.
            </p>
            <p className="mt-4 text-xs text-charcoal/40">Access is granted only after a 72-hour review and identity verification.</p>
          </>
        )}

        {state === "already" && (
          <>
            <h1 className="text-xl font-bold text-navy">Already Confirmed</h1>
            <p className="mt-3 text-sm text-charcoal/60">Your role as Vault Trustee is already active. No further action needed.</p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-navy">Invalid Link</h1>
            <p className="mt-3 text-sm text-charcoal/60">This confirmation link is invalid or has expired. Ask the vault owner to re-add you as a trustee.</p>
          </>
        )}

        <div className="mt-8">
          <Link href="/" className="text-sm text-gold hover:underline">Return to EstateVault</Link>
        </div>
      </div>
    </div>
  );
}
