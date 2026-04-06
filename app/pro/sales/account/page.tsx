"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SalesAccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email || "");
      setFullName(user.user_metadata?.full_name || user.user_metadata?.name || "");
      setPhone(user.user_metadata?.phone || "");
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        phone,
      },
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleResetPassword() {
    setError("");
    setResetSent(false);

    if (!email) {
      setError("No email address found.");
      return;
    }

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/pro/sales/account`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your sales rep profile.</p>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-charcoal mb-1.5">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
            placeholder="Your full name"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-charcoal mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
            placeholder="you@example.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-charcoal mb-1.5">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Commission Rate (read only) */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            Commission Rate
          </label>
          <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
            5% of partner revenue
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Commission rate is set by EstateVault and cannot be changed.
          </p>
        </div>

        {/* Error / Success Messages */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Profile updated successfully.
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-charcoal">Password</h2>
        <p className="text-sm text-gray-500">
          Click below to receive a password reset link at your email address.
        </p>

        {resetSent && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Password reset email sent. Check your inbox.
          </div>
        )}

        <button
          onClick={handleResetPassword}
          className="rounded-lg border border-navy px-5 py-2.5 text-sm font-medium text-navy hover:bg-navy/5 transition-colors"
        >
          Change Password
        </button>
      </div>
    </div>
  );
}
