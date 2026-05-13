"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";

interface VideoMessage {
  id: string;
  title: string;
  duration_seconds: number | null;
  signedUrl: string | null;
  encrypted: boolean;
}

interface DocItem {
  id: string;
  documentType: string;
  status: string;
  createdAt: string;
  signedUrl: string | null;
}

interface CategoryCount {
  category: string;
  count: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  estate_document: "Estate Documents",
  financial_account: "Financial Accounts",
  insurance: "Insurance Policies",
  digital_account: "Digital Accounts",
  physical_location: "Physical Locations",
  contact: "Important Contacts",
  business: "Business Interests",
  final_wishes: "Final Wishes",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  will: "Will",
  trust: "Trust",
  pour_over_will: "Pour-Over Will",
  poa: "Power of Attorney",
  healthcare_directive: "Healthcare Directive",
};

type PageState = "landing" | "submit_certificate" | "verify_access" | "pending" | "viewing" | "success" | "blocked" | "email_sent";

export default function FarewellTrusteePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pageState, setPageState] = useState<PageState>("landing");
  const [blockTitle, setBlockTitle] = useState("");
  const [blockMessage, setBlockMessage] = useState("");
  const [blockAction, setBlockAction] = useState<null | "upload_cert">(null);
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
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [vaultCategories, setVaultCategories] = useState<CategoryCount[]>([]);
  const [grantedScope, setGrantedScope] = useState<{ farewell: boolean; documents: boolean; categories: string[] | null } | null>(null);
  const [vaultUnlock, setVaultUnlock] = useState<{ windowExpiresAt: string | null; emailSent: boolean; accessReady: boolean } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`farewell-block:${clientId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { title: string; message: string; action: null | "upload_cert" };
      setBlockTitle(parsed.title);
      setBlockMessage(parsed.message);
      setBlockAction(parsed.action);
      setPageState("blocked");
    } catch { /* ignore */ }
  }, [clientId]);

  function clearBlock() {
    try { sessionStorage.removeItem(`farewell-block:${clientId}`); } catch { /* ignore */ }
    setBlockAction(null);
  }

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

      clearBlock();
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

      const block = (title: string, message: string, action: null | "upload_cert" = null) => {
        setBlockTitle(title);
        setBlockMessage(message);
        setBlockAction(action);
        setPageState("blocked");
        try {
          sessionStorage.setItem(`farewell-block:${clientId}`, JSON.stringify({ title, message, action }));
        } catch { /* ignore */ }
      };

      if (data.state === "email_sent") {
        setPageState("email_sent");
      } else if (data.state === "unlocked") {
        // Legacy path: kept as fallback in case server returns content.
        setTrusteeName(data.trusteeName);
        setMessages(data.messages || []);
        setDocuments(data.documents || []);
        setVaultCategories(data.vaultCategories || []);
        setGrantedScope(data.scope || null);
        setVaultUnlock(data.vaultUnlock || null);
        setPageState("viewing");
      } else if (data.state === "pending_approval" || data.state === "pending") {
        setPageState("pending");
      } else if (data.state === "trustee_not_confirmed") {
        block("Accept Trustee Role First", "You have not yet accepted the trustee role. Check your email for the confirmation link and accept the role before requesting vault access.");
      } else if (data.state === "no_request") {
        block(
          "Please Upload the Death Certificate First",
          "You have not uploaded a death certificate yet. Upload it and wait for admin approval before you can access any vault content.",
          "upload_cert",
        );
      } else if (data.state === "rejected") {
        block("Request Rejected", "Your access request was rejected. Contact support if you believe this is an error.");
      } else if (data.state === "vetoed") {
        block("Access Cancelled", "The owner has cancelled this access request. No emergency access is available.");
      } else if (data.state === "no_messages") {
        block("Nothing Available", "No farewell messages are available for this account.");
      } else {
        setError("Unable to access messages.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setAccessing(false);
  }

  // ─── Email-sent screen (sign-in link mailed) ──────────────────────
  if (pageState === "email_sent") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl bg-white p-10 shadow-sm border border-gray-200">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-navy">Check Your Email</h1>
            <p className="text-sm text-gray-500 mt-3">
              We sent a sign-in link to <strong className="text-navy">{accessEmail}</strong>. Open it on this device to verify your identity and access the vault.
            </p>
            <p className="text-xs text-gray-400 mt-4">
              The link expires in 7 days. You will be asked for a 6-digit code emailed at sign-in.
            </p>
            <button
              onClick={() => { setPageState("verify_access"); setError(""); }}
              className="mt-6 text-sm text-navy underline hover:text-gold"
            >
              Didn&apos;t get it? Resend
            </button>
          </div>
        </div>
      </div>
    );
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

  // ─── Blocked screen (not approved / not confirmed / etc) ─────────
  if (pageState === "blocked") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl bg-white p-10 shadow-sm border border-gray-200">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-navy">{blockTitle}</h1>
            <p className="text-sm text-gray-500 mt-3">{blockMessage}</p>
            {blockAction === "upload_cert" && (
              <button
                onClick={() => { clearBlock(); setTrusteeEmail(accessEmail); setPageState("submit_certificate"); setError(""); }}
                className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90"
              >
                Upload Death Certificate
              </button>
            )}
            <button
              onClick={() => { clearBlock(); setPageState("verify_access"); setError(""); }}
              className="mt-3 w-full min-h-[44px] rounded-xl border-2 border-navy py-2.5 text-sm font-semibold text-navy hover:bg-navy hover:text-white transition-colors"
            >
              Re-check access status
            </button>
            {blockAction !== "upload_cert" && (
              <button
                onClick={() => { clearBlock(); setPageState("landing"); setAccessEmail(""); setError(""); }}
                className="mt-4 text-sm text-navy underline hover:text-gold"
              >
                Back to start
              </button>
            )}
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
    const now = Date.now();
    const windowExpiresAt = vaultUnlock?.windowExpiresAt ? new Date(vaultUnlock.windowExpiresAt).getTime() : null;
    const msUntilUnlock = windowExpiresAt ? windowExpiresAt - now : null;
    const daysLeft = msUntilUnlock && msUntilUnlock > 0 ? Math.ceil(msUntilUnlock / (1000 * 60 * 60 * 24)) : 0;
    const hoursLeft = msUntilUnlock && msUntilUnlock > 0 ? Math.ceil(msUntilUnlock / (1000 * 60 * 60)) : 0;
    const fullVaultAvailable = !!vaultUnlock?.accessReady;
    const fullVaultEmailSent = !!vaultUnlock?.emailSent;
    const fullVaultPending = msUntilUnlock !== null && msUntilUnlock > 0;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 sm:px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center mb-2">
            <p className="text-2xl font-bold text-navy tracking-tight">EstateVault</p>
            <p className="text-xs text-charcoal/40 mt-1">Emergency Trustee Access</p>
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
                  src={activeVideo.signedUrl ?? undefined}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Hero card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy/90 p-7 shadow-lg">
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/10" />
                <div className="absolute -right-20 -bottom-20 h-48 w-48 rounded-full bg-gold/5" />
                <div className="relative">
                  <p className="text-xs uppercase tracking-widest text-gold/80 font-semibold">Welcome</p>
                  <h1 className="text-2xl font-bold text-white mt-1">{trusteeName}</h1>
                  <p className="text-sm text-white/70 mt-2 max-w-md">
                    The vault owner has granted you emergency access. Below is everything you are authorized to view.
                  </p>
                  {grantedScope && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {grantedScope.farewell && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 text-white text-[11px] font-semibold px-3 py-1.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          Farewell
                        </span>
                      )}
                      {grantedScope.documents && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 text-white text-[11px] font-semibold px-3 py-1.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                          Documents
                        </span>
                      )}
                      {(grantedScope.categories ?? []).map((c) => (
                        <span key={c} className="rounded-full bg-white/10 text-white text-[11px] font-semibold px-3 py-1.5">
                          {CATEGORY_LABELS[c] ?? c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Farewell Messages */}
              {grantedScope?.farewell && (
                <section className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                  <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-navy">Farewell Messages</h2>
                        <p className="text-xs text-charcoal/50">{messages.length} video{messages.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </header>
                  <div className="p-4 sm:p-6">
                    {messages.length === 0 ? (
                      <p className="text-sm text-charcoal/50 text-center py-6">No farewell messages have been recorded.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {messages.map((msg) => {
                          const locked = msg.encrypted || !msg.signedUrl;
                          return (
                            <button
                              key={msg.id}
                              onClick={() => { if (!locked) setActiveVideo(msg); }}
                              disabled={locked}
                              className={`w-full rounded-xl border p-4 text-left transition-colors group flex items-center justify-between gap-4 ${locked ? "border-gray-200 bg-gray-50 cursor-not-allowed" : "border-gray-200 hover:border-gold/50 hover:bg-amber-50/30"}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${locked ? "bg-gray-200" : "bg-navy/10 group-hover:bg-gold/10"} transition-colors`}>
                                  {locked ? (
                                    <svg className="w-4 h-4 text-charcoal/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m12 0a2.25 2.25 0 012.25 2.25v6.75a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25v-6.75a2.25 2.25 0 012.25-2.25h15z" /></svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-navy group-hover:text-gold transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-sm font-semibold truncate ${locked ? "text-charcoal/70" : "text-navy group-hover:text-gold"}`}>{msg.title}</p>
                                  {msg.duration_seconds ? (
                                    <p className="text-xs text-charcoal/50 mt-0.5">Video · {formatDuration(msg.duration_seconds)}{locked ? " · Encrypted" : ""}</p>
                                  ) : locked ? (
                                    <p className="text-xs text-charcoal/50 mt-0.5">Encrypted</p>
                                  ) : null}
                                </div>
                              </div>
                              <span className={`text-xs font-semibold ${locked ? "text-charcoal/40" : "text-navy/60 group-hover:text-gold"}`}>{locked ? "Locked" : "Play →"}</span>
                            </button>
                          );
                        })}
                        {messages.some((m) => m.encrypted) && (
                          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mt-2">
                            <p className="text-xs font-semibold text-amber-900">Encrypted videos require the full vault unlock</p>
                            <p className="text-xs text-amber-800/80 mt-1">
                              {vaultUnlock?.accessReady
                                ? <>Open the &quot;Vault Access Approved&quot; email and click the unlock link to view these videos.</>
                                : vaultUnlock?.windowExpiresAt
                                ? <>You will receive an unlock-link email once the 72-hour owner-veto window ends.</>
                                : <>Contact support if you do not receive an unlock email after admin approval.</>}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Documents */}
              {grantedScope?.documents && (
                <section className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                  <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-navy/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-navy" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-navy">Documents</h2>
                        <p className="text-xs text-charcoal/50">{documents.length} document{documents.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </header>
                  <div className="p-4 sm:p-6">
                    {documents.length === 0 ? (
                      <p className="text-sm text-charcoal/50 text-center py-6">No documents have been generated yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {documents.map((d) => (
                          <div key={d.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-11 w-11 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-red-500">PDF</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-navy truncate">{DOC_TYPE_LABELS[d.documentType] ?? d.documentType}</p>
                                <p className="text-xs text-charcoal/50 mt-0.5 capitalize">{d.status.replace(/_/g, " ")} · {new Date(d.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            {d.signedUrl ? (
                              <a
                                href={d.signedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full bg-navy text-white px-4 py-2 text-xs font-semibold hover:bg-navy/90 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                Open
                              </a>
                            ) : (
                              <span className="text-xs text-charcoal/40">Unavailable</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Vault Items (E2EE — requires full-unlock flow) */}
              {vaultCategories.length > 0 && (
                <section className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                  <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-navy/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-navy" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m12 0a2.25 2.25 0 012.25 2.25v6.75a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25v-6.75a2.25 2.25 0 012.25-2.25h15z" /></svg>
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-navy">Encrypted Vault</h2>
                        <p className="text-xs text-charcoal/50">{vaultCategories.reduce((s, c) => s + c.count, 0)} item{vaultCategories.reduce((s, c) => s + c.count, 0) !== 1 ? "s" : ""} across {vaultCategories.length} categor{vaultCategories.length !== 1 ? "ies" : "y"}</p>
                      </div>
                    </div>
                  </header>
                  <div className="p-4 sm:p-6 space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {vaultCategories.map((c) => (
                        <div key={c.category} className="rounded-xl bg-gradient-to-br from-navy/5 to-navy/[0.02] border border-navy/10 p-4">
                          <p className="text-2xl font-bold text-navy">{c.count}</p>
                          <p className="text-xs font-semibold text-navy/80 mt-1 leading-tight">{CATEGORY_LABELS[c.category] ?? c.category}</p>
                        </div>
                      ))}
                    </div>

                    {fullVaultAvailable && (
                      <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-green-900">Full vault unlock ready</p>
                          <p className="text-xs text-green-700/80 mt-0.5">Use the link in your &quot;Vault Access Approved&quot; email to open the encrypted vault.</p>
                        </div>
                      </div>
                    )}

                    {!fullVaultAvailable && fullVaultPending && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                        <p className="text-sm font-semibold text-amber-900">Full vault unlocks in {daysLeft > 1 ? `${daysLeft} days` : `${hoursLeft}h`}</p>
                        <p className="text-xs text-amber-800/80 mt-1">During the 72-hour owner-veto window, encrypted items cannot be opened. You will receive an email with a one-time unlock link as soon as the window closes.</p>
                      </div>
                    )}

                    {!fullVaultAvailable && !fullVaultPending && fullVaultEmailSent && (
                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                        <p className="text-sm font-semibold text-blue-900">Unlock link expired</p>
                        <p className="text-xs text-blue-800/80 mt-1">The 7-day unlock window has passed. Contact support to re-issue access.</p>
                      </div>
                    )}

                    <p className="text-xs text-charcoal/50 leading-relaxed">
                      Items above are encrypted end-to-end. Only the owner&apos;s designated trustees can reconstruct the decryption key after the security window completes.
                    </p>
                  </div>
                </section>
              )}

            </>
          )}

          <p className="text-center text-xs text-charcoal/40 pt-2">
            EstateVault · This access is private and audited. Do not share this link.
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
