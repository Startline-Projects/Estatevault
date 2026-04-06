"use client";

import { useState, useEffect } from "react";

interface VerificationRequest {
  id: string;
  client_id: string;
  client_name: string;
  trustee_name: string;
  trustee_email: string;
  certificate_url: string | null;
  submitted_at: string;
}

export default function FarewellVerificationPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  async function fetchRequests() {
    try {
      const res = await fetch("/api/admin/farewell-verification");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchRequests(); }, []);

  async function handleAction(requestId: string, action: "approve" | "reject", notes?: string) {
    setProcessingId(requestId);
    setMessage("");

    try {
      const res = await fetch("/api/admin/farewell-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action, notes }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage(action === "approve" ? "Verified and unlocked successfully. Recipient has been notified." : "Request rejected. Trustee has been notified.");
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        setShowRejectModal(null);
      }
    } catch { setMessage("Action failed. Please try again."); }
    setProcessingId(null);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Farewell Verification Queue</h1>
        <p className="text-sm text-gray-500 mt-1">Review death certificate submissions and approve or reject access to farewell messages.</p>
      </div>

      {message && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No pending verification requests.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl bg-white border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">Client: {req.client_name}</p>
                  <p className="text-sm text-gray-600 mt-1">Trustee: {req.trustee_name} ({req.trustee_email})</p>
                  <p className="text-xs text-gray-400 mt-1">Submitted {new Date(req.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                </div>
                <div className="flex items-center gap-2">
                  {req.certificate_url && (
                    <a href={req.certificate_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                      View Certificate
                    </a>
                  )}
                  <button
                    onClick={() => handleAction(req.id, "approve")}
                    disabled={processingId === req.id}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {processingId === req.id ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={() => { setShowRejectModal(req.id); setRejectNotes(""); }}
                    disabled={processingId === req.id}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-navy">Reject Verification</h3>
            <p className="text-sm text-gray-500 mt-1">Provide a reason for rejection (optional).</p>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="e.g., Certificate could not be verified, image unclear..."
              className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setShowRejectModal(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleAction(showRejectModal, "reject", rejectNotes)} disabled={processingId === showRejectModal} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {processingId === showRejectModal ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
