"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clientUrl, partnerUrl, adminUrl, salesUrl, isClientHost, isPartnerHost, isAdminHost, isSalesHost } from "@/lib/hosts";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import PartnerThemedShell, { usePartnerBranding } from "@/components/partner/PartnerThemedShell";

function BrandedWordmark({ className = "" }: { className?: string }) {
  const branding = usePartnerBranding();
  if (branding) return null;
  return <span className={className}>EstateVault</span>;
}

async function navigate(
  router: ReturnType<typeof useRouter>,
  fullUrl: string,
  target: "client" | "partner" | "admin" | "sales",
  redirectPath: string
) {
  if (typeof window === "undefined") return;
  try {
    const dest = new URL(fullUrl);
    if (dest.host === window.location.host) {
      router.push(dest.pathname + dest.search);
      return;
    }
    // Cross-host: get current session tokens, create handoff, sign out locally,
    // then redirect to target host's /auth/handoff with encrypted token.
    const supabase = createBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = fullUrl;
      return;
    }
    const res = await fetch("/api/auth/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        target,
        redirect_path: redirectPath,
      }),
    });
    if (!res.ok) {
      window.location.href = fullUrl;
      return;
    }
    const { url } = await res.json();
    // Do NOT call supabase.auth.signOut here — even scope:"local" hits the
    // /logout API and invalidates the current session_id server-side, which
    // would cause setSession on the target host to fail with
    // "Auth session missing!" (server can't find session_id in DB).
    // Origin keeps the session; both hosts end up signed in to same session.
    window.location.href = url;
  } catch {
    window.location.href = fullUrl;
  }
}

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

    // Restrict client host login to client-side roles only.
    // Admin/partner/sales must log in from their own subdomain.
    const currentHost = window.location.host;
    const onClientHost = isClientHost(currentHost);
    const onPartnerHost = isPartnerHost(currentHost);
    const onAdminHost = isAdminHost(currentHost);
    const onSalesHost = isSalesHost(currentHost);

    const wrongHost =
      (onClientHost && (userType === "partner" || userType === "admin" || userType === "sales_rep" || userType === "review_attorney")) ||
      (onPartnerHost && userType !== "partner") ||
      (onAdminHost && userType !== "admin" && userType !== "review_attorney") ||
      (onSalesHost && userType !== "sales_rep");

    if (wrongHost) {
      await supabase.auth.signOut();
      let portalUrl = "";
      if (userType === "partner") portalUrl = partnerUrl("/auth/login");
      else if (userType === "admin" || userType === "review_attorney") portalUrl = adminUrl("/auth/login");
      else if (userType === "sales_rep") portalUrl = salesUrl("/auth/login");
      else portalUrl = clientUrl("/auth/login");
      setError(
        `This account is not allowed on this site. Please sign in at ${portalUrl}`
      );
      setLoading(false);
      return;
    }

    // Partner-scoped client lockout:
    // A client who belongs to a partner may only sign in from that partner's
    // whitelabel host (subdomain / custom_domain / vault_subdomain). Block
    // login on the generic estatevault.us host so partner clients can't
    // bypass the whitelabel.
    if (userType === "client") {
      const { data: clientRow } = await supabase
        .from("clients")
        .select("partner_id")
        .eq("profile_id", user.id)
        .not("partner_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (clientRow?.partner_id) {
        const { data: partner } = await supabase
          .from("partners")
          .select("subdomain, custom_domain, vault_subdomain, business_name")
          .eq("id", clientRow.partner_id)
          .single();

        const allowedHosts = [
          partner?.subdomain,
          partner?.custom_domain,
          partner?.vault_subdomain ? `${partner.vault_subdomain}.estatevault.us` : null,
        ]
          .filter(Boolean)
          .map((h) => String(h).toLowerCase());

        const hostLower = currentHost.toLowerCase();
        const onAllowedHost = allowedHosts.some(
          (h) => hostLower === h || hostLower === `www.${h}`
        );

        if (!onAllowedHost) {
          await supabase.auth.signOut();
          const target = partner?.custom_domain || partner?.subdomain ||
            (partner?.vault_subdomain ? `${partner.vault_subdomain}.estatevault.us` : null);
          const targetUrl = target ? `https://${target}/auth/login` : "your firm's portal";
          setError(
            `This account is managed by ${partner?.business_name || "your advisor"}. Please sign in at ${targetUrl}.`
          );
          setLoading(false);
          return;
        }
      }
    }

    if (userType === "partner") {
      // Check partner onboarding status
      const { data: partner } = await supabase
        .from("partners")
        .select("onboarding_completed, status")
        .eq("profile_id", user.id)
        .single();

      let path = "/pro/onboarding/step-1";
      if (partner?.status === "pending_verification") {
        path = "/partners/attorneys/welcome";
      } else if (partner?.onboarding_completed) {
        path = "/pro/dashboard";
      }
      await navigate(router, partnerUrl(path), "partner", path);
    } else if (userType === "sales_rep") {
      await navigate(router, salesUrl("/sales/dashboard"), "sales", "/sales/dashboard");
    } else if (userType === "admin") {
      await navigate(router, adminUrl("/sales/dashboard"), "admin", "/sales/dashboard");
    } else if (userType === "review_attorney") {
      await navigate(router, adminUrl("/attorney"), "admin", "/attorney");
    } else if (userType === "affiliate") {
      await navigate(router, clientUrl("/affiliate"), "client", "/affiliate");
    } else {
      await navigate(router, clientUrl(redirect), "client", redirect);
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <h1 className="text-xl font-bold text-navy">Sign In</h1>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
            placeholder="you@example.com"
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
            className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
            placeholder="Enter your password"
          />
        </div>

        <div className="flex justify-end">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-navy/60 hover:text-gold transition-colors"
          >
            Forgot your password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PartnerThemedShell showHeader={false}>
    <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandedWordmark className="text-2xl font-bold text-white" />
        </div>
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
    </PartnerThemedShell>
  );
}
