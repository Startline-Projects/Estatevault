"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";

interface VideoMessage {
  id: string;
  title: string;
  duration_seconds: number | null;
  signedUrl: string;
}

type PageState = "landing" | "submit_certificate" | "verify_access" | "pending" | "viewing" | "success";

export default function FarewellTrusteePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pageState, setPageState] = useState<PageState>("landing");
  const [trusteeEmail, setTrusteeEmail] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // For viewing after approval
  const [accessEmail, setAccessEmail] = useState("");
  const [accessing, setAccessing] = useState(false);
  const [trusteeName, setTrusteeName] = useState("");
  const [messages, setMessages] = useState<VideoMessage[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoMessage | null>(null);

  function formatDuration(seconds: number | null): string {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Submit death certificate for verification
  async function handleCertificateSubmit(e: React.FormEvent) {
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

      setPageState("success");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  // Trustee enters email to access already-unlocked messages
  async function handleAccessMessages(e: React.FormEvent) {
    e.preventDefault();
    if (!accessEmail) return;
    setAccessing(true);
    setError("");

    try {
      const res = await fetch("/api/farewell/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, trusteeEmail: accessEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Unable to access messages.");
        setAccessing(false);
        return;
      }

      if (data.state === "pending") {
        setPageState("pending");
      } else if (data.state === "unlocked") {
        setTrusteeName(data.trusteeName);
        setMessages(data.messages);
        setPageState("viewing");
      } else {
        setError("No farewell messages are available for this account.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setAccessing(false);
  }

  // ─── Success screen ───────────────────────────────────────────────
  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl bg-white p-10 shadow-sm border border-gray-200">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-navy">Request Received</h1>
            <p className="text-sm text-gray-500 mt-3">
              Your request has been received. We will review the submitted documentation and notify you within 24-48 hours.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Pending screen ───────────────────────────────────────────────
  if (pageState === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl bg-white p-10 shadow-sm border border-gray-200">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-navy">Verification In Progress</h1>
            <p className="text-sm text-gray-500 mt-3">
              Your documentation is currently being reviewed. You will receive an email once your access has been approved.
            </p>
            <button
              onClick={() => { setPageState("verify_access"); setError(""); }}
              className="mt-6 text-sm text-navy underline hover:text-gold"
            >
              Already approved? Click here to view messages
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Viewing screen ───────────────────────────────────────────────
  if (pageState === "viewing") {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center mb-2">
            <p className="text-2xl font-bold text-navy">EstateVault</p>
          </div>

          {activeVideo ? (
            <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm space-y-4">
              <button
                onClick={() => setActiveVideo(null)}
                className="text-sm text-navy hover:text-gold transition-colors"
              >
                &larr; Back to all messages
              </button>
              <h2 className="text-lg font-bold text-navy">{activeVideo.title}</h2>
              <div className="rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  src={activeVideo.signedUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-gray-200 p-8 shadow-sm">
              <h1 className="text-xl font-bold text-navy">Messages for {trusteeName}</h1>
              <p className="text-sm text-gray-500 mt-1 mb-6">
                The following farewell messages have been left for you.
              </p>
              <div className="space-y-3">
                {messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => setActiveVideo(msg)}
                    className="w-full rounded-xl border border-gray-200 p-4 text-left hover:border-gold/50 hover:bg-amber-50/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-navy group-hover:text-gold transition-colors">
                          {msg.title}
                        </p>
                        {msg.duration_seconds && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Duration: {formatDuration(msg.duration_seconds)}
                          </p>
                        )}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center group-hover:bg-gold/10 transition-colors">
                        <svg className="w-4 h-4 text-navy group-hover:text-gold transition-colors" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400">
            These messages are private and were left exclusively for you.
          </p>
        </div>
      </div>
    );
  }

  // ─── Verify access (email only, for already-approved trustees) ────
  if (pageState === "verify_access") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <p className="text-2xl font-bold text-navy">EstateVault</p>
          </div>
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200">
            <h1 className="text-xl font-bold text-navy">View Farewell Messages</h1>
            <p className="text-sm text-gray-500 mt-2">
              Enter the email address you were registered with to access your messages.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleAccessMessages} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1">Your Email</label>
                <input
                  type="email"
                  required
                  value={accessEmail}
                  onChange={(e) => setAccessEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
                />
              </div>
              <button
                type="submit"
                disabled={accessing || !accessEmail}
                className="w-full rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {accessing ? "Checking..." : "Access Messages"}
              </button>
            </form>

            <button
              onClick={() => { setPageState("landing"); setError(""); }}
              className="mt-4 w-full text-sm text-center text-gray-400 hover:text-navy"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Landing screen ───────────────────────────────────────────────
  if (pageState === "landing") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <p className="text-2xl font-bold text-navy">EstateVault</p>
          </div>
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200 space-y-4">
            <h1 className="text-xl font-bold text-navy">Access Farewell Messages</h1>
            <p className="text-sm text-gray-500">
              Someone has left a message for you. Choose an option below.
            </p>

            <button
              onClick={() => { setPageState("verify_access"); setError(""); }}
              className="w-full rounded-xl border-2 border-gold bg-gold/5 p-5 text-left hover:bg-gold/10 transition-colors"
            >
              <p className="font-semibold text-navy text-sm">I already have access</p>
              <p className="text-xs text-gray-500 mt-1">My verification was approved, view messages now</p>
            </button>

            <button
              onClick={() => { setPageState("submit_certificate"); setError(""); }}
              className="w-full rounded-xl border-2 border-gray-200 p-5 text-left hover:border-navy/30 transition-colors"
            >
              <p className="font-semibold text-navy text-sm">Submit death certificate</p>
              <p className="text-xs text-gray-500 mt-1">Upload documentation to request access</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Submit certificate screen ────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-2xl font-bold text-navy">EstateVault</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200">
          <h1 className="text-xl font-bold text-navy">Submit for Verification</h1>
          <p className="text-sm text-gray-500 mt-2">
            Upload a death certificate to request access to farewell messages.
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleCertificateSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Your Email</label>
              <input
                type="email"
                required
                value={trusteeEmail}
                onChange={(e) => setTrusteeEmail(e.target.value)}
                placeholder="Enter the email you were registered with"
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">Death Certificate</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setCertificate(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-gray-300 p-6 text-center cursor-pointer hover:border-gold/50 transition-colors"
              >
                {certificate ? (
                  <div>
                    <p className="text-sm font-medium text-navy">{certificate.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{(certificate.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">Click to upload</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, or PNG, max 10MB</p>
                  </>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !trusteeEmail || !certificate}
              className="w-full rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit for Verification"}
            </button>
          </form>

          <button
            onClick={() => { setPageState("landing"); setError(""); }}
            className="mt-4 w-full text-sm text-center text-gray-400 hover:text-navy"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
