"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";

export default function FarewellTrusteePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [trusteeEmail, setTrusteeEmail] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trusteeEmail || !certificate) return;
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("clientId", clientId);
      formData.append("trusteeEmail", trusteeEmail);
      formData.append("certificate", certificate);

      const res = await fetch("/api/farewell/verify", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl bg-white p-10 shadow-sm border border-gray-200">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#1C3557]">Request Received</h1>
            <p className="text-sm text-gray-500 mt-3">
              Your request has been received. We will review the submitted documentation and notify you within 24-48 hours.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-2xl font-bold text-[#1C3557]">EstateVault</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200">
          <h1 className="text-xl font-bold text-[#1C3557]">Access Farewell Messages</h1>
          <p className="text-sm text-gray-500 mt-2">
            Upload a death certificate to access farewell messages left for you.
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1C3557] mb-1">Your Email</label>
              <input
                type="email"
                required
                value={trusteeEmail}
                onChange={(e) => setTrusteeEmail(e.target.value)}
                placeholder="Enter the email registered as trustee"
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-[#C9A84C] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1C3557] mb-1">Death Certificate</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setCertificate(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-gray-300 p-6 text-center cursor-pointer hover:border-[#C9A84C]/50 transition-colors"
              >
                {certificate ? (
                  <div>
                    <p className="text-sm font-medium text-[#1C3557]">{certificate.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{(certificate.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">Click to upload</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, or PNG — max 10MB</p>
                  </>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !trusteeEmail || !certificate}
              className="w-full rounded-full bg-[#C9A84C] py-3.5 text-sm font-semibold text-white hover:bg-[#C9A84C]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit for Verification"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
