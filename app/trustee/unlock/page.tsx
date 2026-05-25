"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Stage = "init" | "sending" | "code" | "verifying" | "unlocked" | "error";

function UnlockInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [stage, setStage] = useState<Stage>("init");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function sendCode() {
    setStage("sending");
    setError("");
    const res = await fetch("/api/trustee/unlock-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const j = await res.json();
    if (!res.ok) { setError(j.error || "Failed to send code"); setStage("error"); return; }
    setStage("code");
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code"); return; }
    setStage("verifying");
    setError("");
    const res = await fetch("/api/trustee/unlock-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, code }),
    });
    const j = await res.json();
    if (!res.ok) { setError(j.error || "Verification failed"); setStage("code"); return; }

    // Option A: the server holds the keys and decrypts vault content on demand.
    // The unlock-verify response set an httpOnly trustee session cookie — just
    // record the access window and proceed to the vault.
    sessionStorage.setItem("trustee_unlock", JSON.stringify({
      accessExpiresAt: j.accessExpiresAt,
    }));
    setStage("unlocked");
    router.push("/trustee/vault");
  }

  return (
    <main style={{ fontFamily: "Inter, sans-serif", maxWidth: 480, margin: "48px auto", padding: 24, color: "#2D2D2D" }}>
      <h1 style={{ color: "#1C3557", fontSize: 28 }}>Open Vault</h1>
      <p style={{ color: "#6b7280" }}>We will email you a 6-digit code to verify your identity.</p>

      {stage === "init" && (
        <button onClick={sendCode}
          style={{ marginTop: 24, width: "100%", background: "#C9A84C", color: "#fff", border: "none", padding: "16px 24px", borderRadius: 9999, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
          Send Code to My Email
        </button>
      )}
      {stage === "sending" && <p>Sending…</p>}

      {(stage === "code" || stage === "verifying") && (
        <>
          <p style={{ marginTop: 16 }}>Check your email and enter the 6-digit code.</p>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="000000"
            style={{ width: "100%", marginTop: 16, padding: 16, fontSize: 24, letterSpacing: 8, textAlign: "center", border: "1px solid #d1d5db", borderRadius: 8 }}
          />
          <button onClick={verify} disabled={stage === "verifying"}
            style={{ marginTop: 16, width: "100%", background: "#1C3557", color: "#fff", border: "none", padding: "16px 24px", borderRadius: 9999, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            {stage === "verifying" ? "Verifying…" : "Verify & Open Vault"}
          </button>
        </>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b" }}>
          {error}
        </div>
      )}

      {stage === "unlocked" && <p style={{ marginTop: 24, color: "#166534" }}>Vault unlocked. Redirecting…</p>}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <UnlockInner />
    </Suspense>
  );
}
