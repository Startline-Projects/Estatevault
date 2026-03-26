"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) { setError(signInError.message); setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Authentication failed"); setLoading(false); return; }

    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();

    if (!profile) { setError("Profile not found"); setLoading(false); return; }

    if (profile.user_type === "client") {
      setError("This portal is for professionals only. Sign in to your client account at estatevault.com");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (profile.user_type === "sales_rep") { router.push("/pro/sales"); return; }
    if (profile.user_type === "admin") { router.push("/pro/admin"); return; }

    if (profile.user_type === "partner") {
      const { data: partner } = await supabase.from("partners").select("onboarding_completed, onboarding_step").eq("profile_id", user.id).single();

      if (!partner || !partner.onboarding_completed) {
        if (partner && partner.onboarding_step > 1) {
          router.push(`/pro/onboarding/step-${partner.onboarding_step}`);
        } else {
          router.push("/pro/preview");
        }
      } else {
        router.push("/pro/dashboard");
      }
      return;
    }

    setError("Unauthorized account type");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            EstateVault <span className="text-gold">Pro</span>
          </h1>
          <p className="mt-2 text-sm text-blue-100/60">The professional estate planning platform</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="text-xl font-bold text-navy">Sign In</h2>

          {error && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-navy mb-1">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30" placeholder="partner@company.com" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-navy mb-1">Password</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30" />
            </div>
            <button type="submit" disabled={loading} className="w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/auth/forgot-password" className="text-sm text-navy/60 hover:text-gold transition-colors">Forgot your password?</Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-blue-100/40">
          Don&apos;t have access? Contact your EstateVault representative to get set up.
        </p>
      </div>
    </div>
  );
}
