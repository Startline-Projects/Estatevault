"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type State =
  | { kind: "loading" }
  | { kind: "valid"; expiresAt: string }
  | { kind: "invalid"; message: string }
  | { kind: "alreadyVetoed" }
  | { kind: "vetoing" }
  | { kind: "done" };

export default function OwnerVetoPage() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "Missing token" });
      return;
    }
    fetch(`/api/farewell/owner-veto?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(j => {
        if (j.alreadyVetoed) setState({ kind: "alreadyVetoed" });
        else if (j.ok) setState({ kind: "valid", expiresAt: j.expiresAt });
        else setState({ kind: "invalid", message: j.error || "Invalid link" });
      })
      .catch(() => setState({ kind: "invalid", message: "Network error" }));
  }, [token]);

  async function veto() {
    setState({ kind: "vetoing" });
    const res = await fetch("/api/farewell/owner-veto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const j = await res.json();
    if (res.ok && j.ok) setState({ kind: "done" });
    else setState({ kind: "invalid", message: j.error || "Failed" });
  }

  return (
    <main style={{ fontFamily: "Inter, sans-serif", maxWidth: 560, margin: "48px auto", padding: 24, color: "#2D2D2D" }}>
      <h1 style={{ color: "#1C3557", fontSize: 28, marginBottom: 8 }}>Cancel Vault Access</h1>
      <p style={{ color: "#6b7280" }}>
        A trustee has requested access to your EstateVault. If you are alive and well, click below to cancel the request.
      </p>

      {state.kind === "loading" && <p>Checking link…</p>}

      {state.kind === "invalid" && (
        <div style={{ marginTop: 24, padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b" }}>
          {state.message}
        </div>
      )}

      {state.kind === "alreadyVetoed" && (
        <div style={{ marginTop: 24, padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534" }}>
          You've already cancelled this request. No further action needed.
        </div>
      )}

      {state.kind === "valid" && (
        <>
          <p style={{ marginTop: 16, fontSize: 14 }}>
            Window expires: <strong>{new Date(state.expiresAt).toLocaleString()}</strong>
          </p>
          <button
            onClick={veto}
            style={{ marginTop: 24, width: "100%", background: "#C9A84C", color: "#fff", border: "none", padding: "16px 24px", borderRadius: 9999, fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            I'm alive — Cancel Access
          </button>
        </>
      )}

      {state.kind === "vetoing" && <p style={{ marginTop: 24 }}>Cancelling…</p>}

      {state.kind === "done" && (
        <div style={{ marginTop: 24, padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534" }}>
          Cancelled. The trustee has been notified. Your vault remains private.
        </div>
      )}
    </main>
  );
}
