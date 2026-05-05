"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function HandoffInner() {
  const params = useSearchParams();
  const token = params.get("t");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing handoff token.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/handoff/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Handoff failed");
        }
        const { access_token, refresh_token, redirect_path } = await res.json();
        const supabase = createClient();
        const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
        if (setErr) throw setErr;
        window.location.replace(redirect_path || "/");
      } catch (e: any) {
        setError(e?.message || "Handoff failed");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        {error ? (
          <>
            <h1 className="text-lg font-bold text-navy">Sign-in handoff failed</h1>
            <p className="mt-3 text-sm text-charcoal/70">{error}</p>
            <a href="/auth/login" className="mt-6 inline-block text-sm text-gold hover:underline">
              Go to login
            </a>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-navy">Signing you in…</h1>
            <p className="mt-3 text-sm text-charcoal/70">One moment.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function HandoffPage() {
  return (
    <Suspense fallback={null}>
      <HandoffInner />
    </Suspense>
  );
}
