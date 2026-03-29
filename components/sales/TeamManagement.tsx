"use client";

import { useState, useEffect } from "react";

interface SalesRep {
  id: string;
  full_name: string;
  email: string;
  active_partners: number;
  created_at: string;
}

export default function TeamManagement() {
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchReps() {
    try {
      const res = await fetch("/api/sales/reps");
      const data = await res.json();
      if (data.reps) setReps(data.reps);
    } catch {
      console.error("Failed to fetch reps");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReps();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/sales/create-rep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: formName, email: formEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create sales rep.");
        setCreating(false);
        return;
      }

      setSuccess(`Account created for ${formName}. Temporary password: ${data.tempPassword}`);
      setFormName("");
      setFormEmail("");
      setShowModal(false);
      fetchReps();
    } catch {
      setError("Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[#2D2D2D]">Team Management</h2>
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#1C3557]/10 text-[#1C3557]">
            Admin Only
          </span>
        </div>
        <button
          onClick={() => { setShowModal(true); setError(""); setSuccess(""); }}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C9A84C] text-white hover:bg-[#b8963f] transition-colors"
        >
          + Add Sales Rep
        </button>
      </div>

      {success && (
        <div className="px-5 pt-3">
          <div className="text-sm px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200">
            {success}
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-5 py-10 text-center">
          <div className="w-6 h-6 border-2 border-[#1C3557] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : reps.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-400">
          No sales reps yet. Add your first team member.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Partners</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((rep) => (
                <tr key={rep.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-[#2D2D2D]">{rep.full_name}</td>
                  <td className="px-5 py-3 text-gray-600">{rep.email}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{rep.active_partners}</td>
                  <td className="px-5 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Sales Rep Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-[#1C3557]">Add Sales Rep</h3>
            <p className="text-sm text-gray-500 mt-1">
              They will receive a welcome email with login credentials.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#1C3557]/30 focus:border-[#1C3557]"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D2D2D] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#1C3557]/30 focus:border-[#1C3557]"
                  placeholder="john@company.com"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-sm font-medium text-[#2D2D2D] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-3 rounded-lg bg-[#1C3557] text-sm font-medium text-white hover:bg-[#1C3557]/90 transition-colors disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
