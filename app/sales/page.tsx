"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SalesLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("Login failed. Please try again.");
        setLoading(false);
        return;
      }

      // Check user type
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", data.user.id)
        .single();

      if (!profile || !["sales_rep", "admin"].includes(profile.user_type)) {
        setError("Access denied.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      router.push("/sales/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1C3557] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] bg-white rounded-xl shadow-lg p-8">
        <p className="text-xs text-gray-400 text-center mb-6">EstateVault Internal</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#1C3557]/20 focus:border-[#1C3557] transition-colors"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#1C3557]/20 focus:border-[#1C3557] transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#1C3557] py-2.5 text-sm font-semibold text-white hover:bg-[#1C3557]/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
