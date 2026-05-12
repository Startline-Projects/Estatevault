"use client";

import { useEffect, useRef, useState } from "react";

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface VaultItem {
  id: string;
  category: string;
  ciphertext: string | null;
  nonce: string | null;
  encVersion: number;
  storagePath: string | null;
  updatedAt: string;
  decrypted?: string;
}

interface DocItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  ciphertext: string | null;
  nonce: string | null;
  encVersion: number;
  createdAt: string;
}

interface FarewellItem {
  id: string;
  title: string;
  durationSeconds: number;
  storagePath: string | null;
  status: string;
  createdAt: string;
}

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARN_AT_MS = 25 * 60 * 1000;

export default function TrusteeVaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [farewell, setFarewell] = useState<FarewellItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [idleWarning, setIdleWarning] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const warnTimer = useRef<number | null>(null);

  function resetIdle() {
    setIdleWarning(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (warnTimer.current) window.clearTimeout(warnTimer.current);
    warnTimer.current = window.setTimeout(() => setIdleWarning(true), WARN_AT_MS);
    idleTimer.current = window.setTimeout(logout, IDLE_LIMIT_MS);
  }

  async function logout() {
    try { await fetch("/api/trustee/logout", { method: "POST" }); } catch {}
    sessionStorage.removeItem("trustee_unlock");
    window.location.href = "/";
  }

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    const handler = () => resetIdle();
    events.forEach(e => window.addEventListener(e, handler));
    resetIdle();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      if (warnTimer.current) window.clearTimeout(warnTimer.current);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/trustee/vault/items");
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const j = await res.json();
        setItems(j.vaultItems);
        setDocs(j.documents);
        setFarewell(j.farewell);

        // Decrypt vault_items labels client-side.
        const { getCryptoWorker } = await import("@/lib/crypto/worker/client");
        const worker = getCryptoWorker();
        const decoded: VaultItem[] = [];
        for (const it of j.vaultItems as VaultItem[]) {
          if (!it.ciphertext) { decoded.push(it); continue; }
          try {
            const plain = await worker.decryptBytes(fromB64(it.ciphertext), "ev:dek:db:v1");
            decoded.push({ ...it, decrypted: new TextDecoder().decode(plain) });
          } catch (e: any) {
            decoded.push({ ...it, decrypted: "[decryption failed]" });
          }
        }
        setItems(decoded);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function download(type: "document" | "farewell", id: string) {
    const res = await fetch(`/api/trustee/vault/download-url?type=${type}&id=${id}`);
    if (!res.ok) { alert("Download failed"); return; }
    const j = await res.json();
    window.open(j.url, "_blank");
  }

  if (loading) return <main style={{ padding: 24, fontFamily: "Inter, sans-serif" }}>Loading vault…</main>;
  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: "Inter, sans-serif", maxWidth: 600 }}>
        <h1 style={{ color: "#1C3557" }}>Cannot Access Vault</h1>
        <div style={{ marginTop: 16, padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b" }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "Inter, sans-serif", maxWidth: 880, margin: "0 auto", padding: 24, color: "#2D2D2D" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ color: "#1C3557", margin: 0 }}>Vault — Read Only</h1>
        <button onClick={logout}
          style={{ background: "#fff", color: "#1C3557", border: "1px solid #1C3557", padding: "8px 16px", borderRadius: 9999, cursor: "pointer", fontWeight: 600 }}>
          Log Out
        </button>
      </div>
      <p style={{ color: "#6b7280", fontSize: 13 }}>
        Session auto-locks after 30 minutes of inactivity. All views and downloads are logged.
      </p>

      {idleWarning && (
        <div style={{ marginTop: 12, padding: 12, background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, color: "#92400e" }}>
          You'll be logged out in 5 minutes due to inactivity. Move your mouse to stay signed in.
        </div>
      )}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ color: "#1C3557", fontSize: 18 }}>Vault Items ({items.length})</h2>
        {items.length === 0 && <p style={{ color: "#9ca3af" }}>None.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {items.map(it => (
            <li key={it.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase" }}>{it.category}</div>
              <div style={{ fontWeight: 600 }}>{it.decrypted || "[encrypted]"}</div>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ color: "#1C3557", fontSize: 18 }}>Documents ({docs.length})</h2>
        {docs.length === 0 && <p style={{ color: "#9ca3af" }}>None.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {docs.map(d => (
            <li key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{d.filename}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{(d.sizeBytes / 1024).toFixed(1)} KB · {new Date(d.createdAt).toLocaleDateString()}</div>
              </div>
              <button onClick={() => download("document", d.id)}
                style={{ background: "#C9A84C", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 9999, cursor: "pointer", fontWeight: 600 }}>
                Download
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ color: "#1C3557", fontSize: 18 }}>Farewell Messages ({farewell.length})</h2>
        {farewell.length === 0 && <p style={{ color: "#9ca3af" }}>None.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {farewell.map(f => (
            <li key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{f.durationSeconds}s · {f.status}</div>
              </div>
              {f.storagePath && (
                <button onClick={() => download("farewell", f.id)}
                  style={{ background: "#1C3557", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 9999, cursor: "pointer", fontWeight: 600 }}>
                  Play
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
