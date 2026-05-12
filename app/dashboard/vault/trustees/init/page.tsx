"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getShamirStatus, postShamirSetup } from "@/lib/repos/cryptoRepo";
import { getCryptoWorker } from "@/lib/crypto/worker/client";

type Stage = "checking" | "already" | "ready" | "working" | "done" | "error";

export default function TrusteeShamirInitPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = await getShamirStatus();
        if (s.initialized) setStage("already");
        else setStage("ready");
      } catch (e: any) {
        setError(e?.message || "Failed to check status");
        setStage("error");
      }
    })();
  }, []);

  async function run() {
    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      setError("Recovery phrase must be 12 or 24 words.");
      return;
    }

    setStage("working");
    setError("");
    try {
      const worker = getCryptoWorker();
      const state = await worker.getState();
      if (state !== "unlocked") {
        setError("Vault must be unlocked first. Open the vault, enter your passphrase, then return here.");
        setStage("ready");
        return;
      }
      const out = await worker.setupTrusteeShamir({ mnemonic: words.join(" ") });
      await postShamirSetup(out);
      setStage("done");
    } catch (e: any) {
      setError(e?.message || "Setup failed");
      setStage("ready");
    } finally {
      setMnemonic("");
    }
  }

  return (
    <main style={{ fontFamily: "Inter, sans-serif", maxWidth: 640, margin: "32px auto", padding: 24, color: "#2D2D2D" }}>
      <h1 style={{ color: "#1C3557", fontSize: 28, marginBottom: 8 }}>Initialize Trustee Access</h1>
      <p style={{ color: "#6b7280" }}>
        One-time setup. Splits your vault key so trustees can request emergency access after a 72-hour review.
        Your master passphrase and recovery words remain unchanged.
      </p>

      {stage === "checking" && <p style={{ marginTop: 24 }}>Checking status…</p>}

      {stage === "already" && (
        <div style={{ marginTop: 24, padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534" }}>
          Trustee access is already initialized. You can add trustees now.
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => router.push("/dashboard/vault/trustees")}
              style={{ background: "#1C3557", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 9999, cursor: "pointer", fontWeight: 600 }}>
              Go to Trustees
            </button>
          </div>
        </div>
      )}

      {(stage === "ready" || stage === "working") && (
        <>
          <div style={{ marginTop: 24, padding: 16, background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, color: "#92400e" }}>
            <strong>Before you continue:</strong>
            <ol style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>Your vault must be unlocked in this browser session.</li>
              <li>Have your 12 or 24-word recovery phrase ready (shown at signup).</li>
              <li>Words go in lowercase, separated by spaces.</li>
            </ol>
          </div>

          <label style={{ display: "block", marginTop: 24, fontWeight: 600 }}>Recovery phrase</label>
          <textarea
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            rows={4}
            placeholder="word1 word2 word3 …"
            spellCheck={false}
            autoComplete="off"
            style={{ width: "100%", marginTop: 8, padding: 12, fontSize: 14, fontFamily: "monospace", border: "1px solid #d1d5db", borderRadius: 8 }}
          />

          {error && (
            <div style={{ marginTop: 12, padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b" }}>
              {error}
            </div>
          )}

          <button
            onClick={run}
            disabled={stage === "working" || mnemonic.trim().length === 0}
            style={{
              marginTop: 24, width: "100%",
              background: stage === "working" ? "#9ca3af" : "#C9A84C",
              color: "#fff", border: "none", padding: "16px 24px", borderRadius: 9999,
              fontSize: 16, fontWeight: 600, cursor: stage === "working" ? "not-allowed" : "pointer",
            }}>
            {stage === "working" ? "Setting up…" : "Initialize Trustee Access"}
          </button>

          <p style={{ marginTop: 16, fontSize: 12, color: "#9ca3af" }}>
            Your phrase is processed in your browser only. It is never sent to our servers.
          </p>
        </>
      )}

      {stage === "done" && (
        <div style={{ marginTop: 24, padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534" }}>
          Trustee access initialized. You can now add trustees.
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => router.push("/dashboard/vault/trustees")}
              style={{ background: "#1C3557", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 9999, cursor: "pointer", fontWeight: 600 }}>
              Go to Trustees
            </button>
          </div>
        </div>
      )}

      {stage === "error" && (
        <div style={{ marginTop: 24, padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b" }}>
          {error}
        </div>
      )}
    </main>
  );
}
