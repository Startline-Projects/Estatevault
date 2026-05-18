"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function VerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = (searchParams.get("type") || "signup") as
      | "signup"
      | "email"
      | "invite"
      | "magiclink"
      | "recovery"
      | "email_change";

    if (!tokenHash) {
      setStatus("error");
      setError("Missing verification token. Open the link from your email.");
      return;
    }

    const supabase = createClient();

    (async () => {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (verifyErr) {
        setStatus("error");
        setError(verifyErr.message || "This link is invalid or has expired.");
        return;
      }

      try {
        await fetch("/api/auth/welcome", { method: "POST" });
      } catch (mailErr) {
        console.error("welcome email kick-off failed:", mailErr);
      }

      setStatus("success");

      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role || user?.user_metadata?.user_type;
      const dest =
        role === "partner" ? "/pro" :
        role === "admin" ? "/admin" :
        role === "sales_rep" ? "/sales" :
        "/dashboard";
      setTimeout(() => router.push(dest), 1500);
    })();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-2xl font-bold text-white mb-8">
          EstateVault
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-xl text-center">
          {status === "verifying" && (
            <>
              <div className="mx-auto h-10 w-10 border-4 border-navy border-t-transparent rounded-full animate-spin" />
              <h1 className="mt-6 text-xl font-bold text-navy">Verifying your email...</h1>
              <p className="mt-3 text-sm text-charcoal/60">Hang tight.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
                <span className="text-3xl text-gold">&#10003;</span>
              </div>
              <h1 className="mt-6 text-xl font-bold text-navy">Email confirmed</h1>
              <p className="mt-3 text-sm text-charcoal/60">Taking you to your dashboard...</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <span className="text-3xl text-red-500">!</span>
              </div>
              <h1 className="mt-6 text-xl font-bold text-navy">Verification failed</h1>
              <p className="mt-3 text-sm text-red-600">{error}</p>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href="/auth/verify-email"
                  className="text-sm font-medium text-navy hover:text-gold transition-colors"
                >
                  Request a new verification link
                </Link>
                <Link
                  href="/auth/login"
                  className="text-sm text-charcoal/60 hover:text-navy transition-colors"
                >
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
