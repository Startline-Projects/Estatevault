"use client";

import { useState, useEffect, useCallback } from "react";
import SubscriptionBanner from "@/components/dashboard/SubscriptionBanner";
import FarewellRecorder from "@/components/dashboard/FarewellRecorder";
import FarewellUploader from "@/components/dashboard/FarewellUploader";

interface FarewellMessage {
  id: string;
  title: string;
  recipient_email: string;
  file_size_mb: number | null;
  duration_seconds: number | null;
  vault_farewell_status: string;
  created_at: string;
  updated_at: string;
}

type Mode = "list" | "new" | "record" | "upload";

export default function FarewellMessagesPage() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [messages, setMessages] = useState<FarewellMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("list");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newRecipient, setNewRecipient] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const handleStatusLoaded = useCallback((status: { canUseFarewell: boolean }) => {
    setIsSubscribed(status.canUseFarewell);
  }, []);

  async function fetchMessages() {
    try {
      const res = await fetch("/api/vault/farewell");
      const data = await res.json();
      setMessages(data.messages || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchMessages(); }, []);

  async function handleCreateMessage() {
    if (!newTitle.trim() || !newRecipient.trim()) {
      setError("Title and recipient email are required.");
      return;
    }
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/vault/farewell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, recipientEmail: newRecipient }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create"); setCreating(false); return; }

      setActiveMessageId(data.messageId);
      setShowCreateForm(false);
      // Ask user to choose record or upload
      setMode("new");
    } catch {
      setError("Something went wrong.");
    }
    setCreating(false);
  }

  async function handleDelete(messageId: string, title: string) {
    const confirmed = window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone. Your designated recipient will no longer be able to access it.`);
    if (!confirmed) return;

    try {
      await fetch("/api/vault/farewell", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      fetchMessages();
    } catch { /* ignore */ }
  }

  async function handlePreview(messageId: string, title: string) {
    try {
      const res = await fetch(`/api/vault/farewell/${messageId}/signed-url`);
      const data = await res.json();
      if (data.signedUrl) {
        setPreviewUrl(data.signedUrl);
        setPreviewTitle(title);
      }
    } catch { /* ignore */ }
  }

  function handleUploadComplete() {
    setMode("list");
    setActiveMessageId(null);
    setNewTitle("");
    setNewRecipient("");
    fetchMessages();
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return "--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function statusBadge(status: string) {
    switch (status) {
      case "locked": return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Locked</span>;
      case "pending_verification": return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Pending Verification</span>;
      case "unlocked": return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Unlocked</span>;
      default: return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{status}</span>;
    }
  }

  // Show subscription gate if not subscribed
  if (!loading && !isSubscribed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Farewell Messages</h1>
          <p className="text-sm text-charcoal/60 mt-1">Record personal video messages for your loved ones.</p>
        </div>
        <SubscriptionBanner onStatusLoaded={handleStatusLoaded} />
        <div className="rounded-xl bg-white border border-gray-200 p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-navy/5 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-navy/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Subscribe to the Vault Plan ($99/year) to access Farewell Messages.</p>
        </div>
      </div>
    );
  }

  // Preview modal
  if (previewUrl) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setPreviewUrl(null); setPreviewTitle(""); }} className="text-sm text-navy hover:text-gold transition-colors">
          &larr; Back to messages
        </button>
        <div className="rounded-xl bg-white border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-navy mb-2">{previewTitle}</h2>
          <p className="text-xs text-gray-400 mb-4">This is your recorded farewell message. This video will only be visible to your designated recipient after a death certificate is uploaded and verified.</p>
          <div className="rounded-lg overflow-hidden bg-black aspect-video">
            <video src={previewUrl} controls className="w-full h-full object-contain" />
          </div>
        </div>
      </div>
    );
  }

  // Record or Upload mode
  if (mode === "record" && activeMessageId) {
    return (
      <div className="space-y-4">
        <button onClick={() => setMode("list")} className="text-sm text-navy hover:text-gold">&larr; Back</button>
        <h2 className="text-lg font-bold text-navy">Record Your Message</h2>
        <FarewellRecorder messageId={activeMessageId} onComplete={handleUploadComplete} onCancel={() => setMode("list")} />
      </div>
    );
  }

  if (mode === "upload" && activeMessageId) {
    return (
      <div className="space-y-4">
        <button onClick={() => setMode("list")} className="text-sm text-navy hover:text-gold">&larr; Back</button>
        <h2 className="text-lg font-bold text-navy">Upload Your Video</h2>
        <FarewellUploader messageId={activeMessageId} onComplete={handleUploadComplete} onCancel={() => setMode("list")} />
      </div>
    );
  }

  // Choose record or upload after creating message
  if (mode === "new" && activeMessageId) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setMode("list"); setActiveMessageId(null); }} className="text-sm text-navy hover:text-gold">&larr; Back</button>
        <h2 className="text-lg font-bold text-navy">How would you like to add your video?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => setMode("record")} className="rounded-xl border-2 border-gray-200 hover:border-gold p-8 text-center transition-colors">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
              <div className="w-4 h-4 rounded-full bg-red-500" />
            </div>
            <p className="font-semibold text-navy">Record Now</p>
            <p className="text-xs text-gray-400 mt-1">Use your camera to record</p>
          </button>
          <button onClick={() => setMode("upload")} className="rounded-xl border-2 border-gray-200 hover:border-gold p-8 text-center transition-colors">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="font-semibold text-navy">Upload Video</p>
            <p className="text-xs text-gray-400 mt-1">MP4, MOV, WebM — max 500MB</p>
          </button>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Farewell Messages</h1>
          <p className="text-sm text-charcoal/60 mt-1">Personal video messages for your loved ones.</p>
        </div>
        <button
          onClick={() => {
            setNewTitle("");
            setNewRecipient("");
            setError("");
            setShowCreateForm((v) => !v);
          }}
          className="px-4 py-2 rounded-lg bg-gold text-sm font-semibold text-white hover:bg-gold/90 transition-colors"
        >
          {showCreateForm ? "Cancel" : "+ New Message"}
        </button>
      </div>

      <SubscriptionBanner onStatusLoaded={handleStatusLoaded} />

      {/* Create message form — shown when user clicks "+ New Message" */}
      {showCreateForm && (
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-navy mb-3">Create a New Farewell Message</h3>
          {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-charcoal mb-1">Title</label>
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder='e.g., "For Sarah"' className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal mb-1">Recipient Email</label>
              <input type="email" value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)} placeholder="recipient@email.com" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
            </div>
          </div>
          <button onClick={handleCreateMessage} disabled={creating || !newTitle.trim() || !newRecipient.trim()} className="mt-3 px-4 py-2 rounded-lg bg-navy text-sm font-medium text-white hover:bg-navy/90 transition-colors disabled:opacity-50">
            {creating ? "Creating..." : "Continue"}
          </button>
        </div>
      )}

      {/* Messages list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No farewell messages yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="rounded-xl bg-white border border-gray-200 p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-navy">{msg.title}</p>
                  {statusBadge(msg.vault_farewell_status)}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  To: {msg.recipient_email} · {formatDuration(msg.duration_seconds)} · {new Date(msg.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {msg.file_size_mb && (
                  <button onClick={() => handlePreview(msg.id, msg.title)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-navy/10 text-navy hover:bg-navy/20 transition-colors">
                    Preview
                  </button>
                )}
                {msg.vault_farewell_status !== "unlocked" && (
                  <button onClick={() => handleDelete(msg.id, msg.title)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
