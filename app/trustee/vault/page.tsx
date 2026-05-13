"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface RawVaultItem {
  id: string;
  category: string;
  ciphertext: string | null;
  nonce: string | null;
  encVersion: number;
  storagePath: string | null;
  updatedAt: string;
  decrypted?: string;
}

interface RawDocItem {
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

interface RawFarewell {
  id: string;
  title: string;
  durationSeconds: number;
  storagePath: string | null;
  status: string;
  createdAt: string;
  storageHeader: string | null;
  encVersion: number | null;
}

interface NormalDoc {
  source: "document" | "vault_item";
  id: string;
  title: string;
  filename: string;
  sizeBytes: number | null;
  createdAt: string;
  storagePath: string | null;
  docType?: string;
}

interface RegularItem {
  id: string;
  category: string;
  label: string;
  data: Record<string, unknown>;
  raw?: string;
  parseFailed?: boolean;
  updatedAt: string;
}

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARN_AT_MS = 25 * 60 * 1000;
const INFO_FILES = "ev:dek:files:v1";

const NAVY = "#1C3557";
const GOLD = "#C9A84C";
const INK = "#2D2D2D";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const SOFT = "#f9fafb";

const CATEGORY_LABELS: Record<string, string> = {
  business: "Business",
  digital_account: "Digital Account",
  estate_document: "Estate Document",
  final_wishes: "Final Wishes",
  financial: "Financial",
  financial_account: "Financial Account",
  insurance: "Insurance",
  physical_location: "Physical Location",
  contact: "Contact",
};

function categoryLabelFor(c: string): string {
  return CATEGORY_LABELS[c.toLowerCase()] || c.replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
}

const FIELD_LABELS: Record<string, string> = {
  ownership_pct: "Ownership %",
  business_type: "Business Type",
  agreement_location: "Agreement Location",
  co_owners: "Co-Owners",
  notes: "Notes",
  platform: "Platform",
  username: "Username",
  password: "Password",
  memorial: "Memorial Wishes",
  doc_type: "Document Type",
  file_name: "File",
  file_size: "Size",
  uploaded_at: "Uploaded",
  wishes: "Wishes",
  account_number: "Account",
  institution: "Institution",
  balance: "Balance",
  policy_number: "Policy #",
  provider: "Provider",
  address: "Address",
  description: "Description",
};

function prettyKey(k: string): string {
  return FIELD_LABELS[k] || k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatVal(key: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (key === "uploaded_at" && typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  }
  if (key === "file_size" && typeof val === "number") {
    if (val < 1024) return `${val} B`;
    if (val < 1024 * 1024) return `${(val / 1024).toFixed(1)} KB`;
    return `${(val / 1024 / 1024).toFixed(1)} MB`;
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function SecretField({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: "monospace", letterSpacing: show ? 0 : 2 }}>
        {show ? value : "•".repeat(Math.min(value.length, 12))}
      </span>
      <button
        onClick={() => setShow(s => !s)}
        style={{
          background: "transparent",
          border: `1px solid ${BORDER}`,
          color: NAVY,
          padding: "2px 10px",
          borderRadius: 9999,
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function FieldRow({ k, v }: { k: string; v: unknown }) {
  const isSecret = k === "password";
  return (
    <>
      <dt style={{ color: MUTED, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {prettyKey(k)}
      </dt>
      <dd style={{ margin: 0, color: INK, fontSize: 14, wordBreak: "break-word" }}>
        {isSecret && typeof v === "string" && v.length > 0
          ? <SecretField value={v} />
          : formatVal(k, v)}
      </dd>
    </>
  );
}

function ItemCard({ item }: { item: RegularItem }) {
  const categoryLabel = categoryLabelFor(item.category);
  const entries = Object.entries(item.data).filter(([, v]) => v !== null && v !== undefined && v !== "");

  return (
    <li
      style={{
        listStyle: "none",
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        marginBottom: 12,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          background: SOFT,
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            {categoryLabel}
          </span>
          <span style={{ fontWeight: 600, color: NAVY, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.label || (item.parseFailed ? "Locked" : "Untitled")}
          </span>
        </div>
        <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>
          {new Date(item.updatedAt).toLocaleDateString()}
        </span>
      </div>

      {item.parseFailed && (
        <div style={{ padding: 16, color: "#991b1b", background: "#fef2f2", fontSize: 13 }}>
          Could not decrypt this item. Vault keys may be out of date.
        </div>
      )}

      {item.raw && (
        <div style={{ padding: 16, fontSize: 13, color: INK, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {item.raw}
        </div>
      )}

      {!item.raw && entries.length > 0 && (
        <dl style={{ margin: 0, padding: 16, display: "grid", gridTemplateColumns: "minmax(120px, 30%) 1fr", rowGap: 10, columnGap: 16 }}>
          {entries.map(([k, v]) => <FieldRow key={k} k={k} v={v} />)}
        </dl>
      )}

      {!item.raw && entries.length === 0 && !item.parseFailed && (
        <div style={{ padding: 16, color: MUTED, fontSize: 13, fontStyle: "italic" }}>
          No additional details.
        </div>
      )}
    </li>
  );
}

export default function TrusteeVaultPage() {
  const [items, setItems] = useState<RegularItem[]>([]);
  const [documents, setDocuments] = useState<NormalDoc[]>([]);
  const [farewell, setFarewell] = useState<RawFarewell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [idleWarning, setIdleWarning] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("");
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
        const rawItems = (j.vaultItems || []) as RawVaultItem[];
        const rawDocs = (j.documents || []) as RawDocItem[];
        const rawFarewell = (j.farewell || []) as RawFarewell[];

        const { getCryptoWorker } = await import("@/lib/crypto/worker/client");
        const worker = getCryptoWorker();

        const regular: RegularItem[] = [];
        const docFromVault: NormalDoc[] = [];

        for (const it of rawItems) {
          let decrypted: string | undefined;
          if (it.ciphertext) {
            try {
              const plain = await worker.decryptBytes(fromB64(it.ciphertext), "ev:dek:db:v1");
              decrypted = new TextDecoder().decode(plain);
            } catch {
              decrypted = undefined;
            }
          }

          let label = "";
          let data: Record<string, unknown> = {};
          let raw: string | undefined;
          let parseFailed = !decrypted && !!it.ciphertext;

          if (decrypted) {
            try {
              const parsed = JSON.parse(decrypted);
              label = typeof parsed?.label === "string" ? parsed.label : "";
              data = parsed?.data && typeof parsed.data === "object" ? parsed.data : {};
            } catch {
              raw = decrypted;
            }
          }

          if (it.category.toLowerCase() === "estate_document" && it.storagePath) {
            const fileName = typeof data.file_name === "string" ? data.file_name : "";
            docFromVault.push({
              source: "vault_item",
              id: it.id,
              title: label || fileName || "Document",
              filename: fileName || label || "document",
              sizeBytes: typeof data.file_size === "number" ? data.file_size : null,
              createdAt: typeof data.uploaded_at === "string" ? data.uploaded_at : it.updatedAt,
              storagePath: it.storagePath,
              docType: typeof data.doc_type === "string" ? data.doc_type : undefined,
            });
            continue;
          }

          regular.push({
            id: it.id,
            category: it.category,
            label,
            data,
            raw,
            parseFailed,
            updatedAt: it.updatedAt,
          });
        }

        const docsFromTable: NormalDoc[] = rawDocs.map(d => ({
          source: "document",
          id: d.id,
          title: d.filename,
          filename: d.filename,
          sizeBytes: d.sizeBytes,
          createdAt: d.createdAt,
          storagePath: d.storagePath,
        }));

        setItems(regular);
        setDocuments([...docsFromTable, ...docFromVault]);
        setFarewell(rawFarewell);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function downloadDoc(doc: NormalDoc) {
    setBusyId(doc.id);
    try {
      const type = doc.source === "vault_item" ? "vault_item" : "document";
      const r = await fetch(`/api/trustee/vault/download-url?type=${type}&id=${doc.id}`);
      if (!r.ok) throw new Error("download url failed");
      const { url } = await r.json();
      const cipherRes = await fetch(url);
      if (!cipherRes.ok) throw new Error("storage fetch failed");
      const cipher = new Uint8Array(await cipherRes.arrayBuffer());

      const { getCryptoWorker } = await import("@/lib/crypto/worker/client");
      const worker = getCryptoWorker();
      const plain = await worker.decryptBytes(cipher, INFO_FILES);

      const blob = new Blob([plain.buffer.slice(plain.byteOffset, plain.byteOffset + plain.byteLength)]);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.filename || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (e: any) {
      alert(`Download failed: ${e?.message || "unknown"}`);
    } finally {
      setBusyId(null);
    }
  }

  async function playFarewell(f: RawFarewell) {
    if (!f.storagePath) return;
    if (!f.storageHeader) {
      alert("This message is missing playback metadata. Ask the owner to re-upload.");
      return;
    }
    setBusyId(f.id);
    try {
      const r = await fetch(`/api/trustee/vault/download-url?type=farewell&id=${f.id}`);
      if (!r.ok) throw new Error("download url failed");
      const { url } = await r.json();
      const cipherRes = await fetch(url);
      if (!cipherRes.ok) throw new Error("storage fetch failed");

      const { getCryptoWorker } = await import("@/lib/crypto/worker/client");
      const worker = getCryptoWorker();
      const { sessionId } = await worker.beginDecryptStream(INFO_FILES, fromB64(f.storageHeader));

      const reader = cipherRes.body!.getReader();
      let buffer = new Uint8Array(0);
      let done = false;
      let final = false;
      const plainChunks: Uint8Array[] = [];

      async function fill(min: number) {
        while (buffer.length < min && !done) {
          const c = await reader.read();
          if (c.done) { done = true; break; }
          const next = new Uint8Array(buffer.length + c.value.length);
          next.set(buffer, 0);
          next.set(c.value, buffer.length);
          buffer = next;
        }
        return buffer.length >= min;
      }

      while (!final) {
        if (!(await fill(4))) break;
        const len = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(0, false);
        buffer = buffer.slice(4);
        if (!(await fill(len))) throw new Error("truncated stream");
        const ct = buffer.slice(0, len);
        buffer = buffer.slice(len);
        const out = await worker.pullDecryptStream(sessionId, ct);
        if (out.plaintext.length > 0) plainChunks.push(out.plaintext);
        final = out.final;
      }
      await worker.endStream(sessionId).catch(() => undefined);

      const blob = new Blob(
        plainChunks.map(u => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)),
        { type: "video/mp4" },
      );
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(URL.createObjectURL(blob));
      setVideoTitle(f.title);
    } catch (e: any) {
      alert(`Playback failed: ${e?.message || "unknown"}`);
    } finally {
      setBusyId(null);
    }
  }

  function closeVideo() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setVideoTitle("");
  }

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(it => {
      if (it.category.toLowerCase().includes(q)) return true;
      if (it.label.toLowerCase().includes(q)) return true;
      return JSON.stringify(it.data).toLowerCase().includes(q);
    });
  }, [items, query]);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        <div style={{ color: NAVY, fontSize: 14 }}>Loading vault…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ minHeight: "100vh", background: SOFT, fontFamily: "Inter, sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 600, margin: "64px auto" }}>
          <h1 style={{ color: NAVY, fontSize: 24, marginBottom: 12 }}>Cannot Access Vault</h1>
          <div style={{ padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, color: "#991b1b" }}>
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: SOFT, fontFamily: "Inter, sans-serif", color: INK }}>
      <header
        style={{
          background: "#fff",
          borderBottom: `1px solid ${BORDER}`,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
              <h1 style={{ color: NAVY, margin: 0, fontSize: 20, fontWeight: 700 }}>Vault — Read Only</h1>
            </div>
            <p style={{ color: MUTED, fontSize: 12, margin: "4px 0 0 18px" }}>
              Auto-locks after 30 min idle · All access is audited
            </p>
          </div>
          <button
            onClick={logout}
            style={{
              background: "#fff",
              color: NAVY,
              border: `1px solid ${NAVY}`,
              padding: "8px 18px",
              borderRadius: 9999,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Log Out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 48px" }}>
        {idleWarning && (
          <div style={{ marginBottom: 24, padding: "12px 16px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 12, color: "#92400e", fontSize: 13 }}>
            You will be logged out in 5 minutes due to inactivity. Move your mouse to stay signed in.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
          <SummaryCard label="Vault Items" count={items.length} accent={GOLD} />
          <SummaryCard label="Documents" count={documents.length} accent={NAVY} />
          <SummaryCard label="Farewell Messages" count={farewell.length} accent="#7c3aed" />
        </div>

        <section style={{ marginBottom: 40 }}>
          <SectionHeader title="Vault Items" count={filteredItems.length} total={items.length}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search items…"
              style={{ padding: "8px 14px", border: `1px solid ${BORDER}`, borderRadius: 9999, fontSize: 13, outline: "none", width: 220, background: "#fff" }}
            />
          </SectionHeader>
          {filteredItems.length === 0 ? (
            <EmptyState text={items.length === 0 ? "No vault items released." : "No items match your search."} />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {filteredItems.map(it => <ItemCard key={it.id} item={it} />)}
            </ul>
          )}
        </section>

        <section style={{ marginBottom: 40 }}>
          <SectionHeader title="Documents" count={documents.length} />
          {documents.length === 0 ? (
            <EmptyState text="No documents released." />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {documents.map(d => (
                <li
                  key={`${d.source}-${d.id}`}
                  style={{
                    background: "#fff",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 12,
                    marginBottom: 12,
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{d.title}</span>
                      {d.docType && (
                        <span
                          style={{
                            background: "#fdf6e3",
                            color: GOLD,
                            padding: "2px 10px",
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "capitalize",
                          }}
                        >
                          {d.docType}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: MUTED,
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.filename && d.filename !== d.title ? `${d.filename} · ` : ""}
                      {formatSize(d.sizeBytes)} · Uploaded {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => downloadDoc(d)}
                    disabled={busyId === d.id}
                    style={{
                      background: GOLD,
                      color: "#fff",
                      border: "none",
                      padding: "8px 18px",
                      borderRadius: 9999,
                      cursor: busyId === d.id ? "wait" : "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                      flexShrink: 0,
                      opacity: busyId === d.id ? 0.6 : 1,
                    }}
                  >
                    {busyId === d.id ? "Decrypting…" : "Download"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeader title="Farewell Messages" count={farewell.length} />
          {farewell.length === 0 ? (
            <EmptyState text="No farewell messages released." />
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {farewell.map(f => (
                <li
                  key={f.id}
                  style={{
                    background: "#fff",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 12,
                    marginBottom: 12,
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, color: NAVY }}>{f.title || "Untitled"}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                      {f.durationSeconds}s · <span style={{ color: f.status === "unlocked" ? "#059669" : MUTED }}>{f.status}</span>
                    </div>
                  </div>
                  {f.storagePath && (
                    <button
                      onClick={() => playFarewell(f)}
                      disabled={busyId === f.id}
                      style={{
                        background: NAVY,
                        color: "#fff",
                        border: "none",
                        padding: "8px 18px",
                        borderRadius: 9999,
                        cursor: busyId === f.id ? "wait" : "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                        flexShrink: 0,
                        opacity: busyId === f.id ? 0.6 : 1,
                      }}
                    >
                      {busyId === f.id ? "Decrypting…" : "Play"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {videoUrl && (
        <div
          onClick={closeVideo}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#000",
              borderRadius: 12,
              maxWidth: 900,
              width: "100%",
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                background: NAVY,
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 600,
              }}
            >
              <span>{videoTitle}</span>
              <button
                onClick={closeVideo}
                style={{
                  background: "transparent",
                  border: "1px solid #fff",
                  color: "#fff",
                  padding: "4px 12px",
                  borderRadius: 9999,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
            <video
              src={videoUrl}
              controls
              autoPlay
              style={{ width: "100%", maxHeight: "80vh", background: "#000" }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ label, count, accent }: { label: string; count: number; accent: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: accent }} />
      <div style={{ paddingLeft: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: NAVY, lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  total,
  children,
}: {
  title: string;
  count: number;
  total?: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <h2 style={{ color: NAVY, fontSize: 18, margin: 0, fontWeight: 700 }}>
        {title}{" "}
        <span style={{ color: MUTED, fontWeight: 500, fontSize: 14 }}>
          ({count}{total !== undefined && total !== count ? ` of ${total}` : ""})
        </span>
      </h2>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px dashed ${BORDER}`,
        borderRadius: 12,
        padding: 32,
        textAlign: "center",
        color: MUTED,
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}
