"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SubscriptionBanner from "@/components/dashboard/SubscriptionBanner";

interface VaultItem {
  id: string;
  category: string;
  label: string;
  data: Record<string, unknown>;
  created_at: string;
}

const CATEGORIES = [
  { key: "estate_document", icon: "📄", label: "Estate Documents", vaultOnly: true },
  { key: "financial_account", icon: "🏦", label: "Financial Accounts", vaultOnly: true },
  { key: "insurance", icon: "🛡", label: "Insurance Policies", vaultOnly: true },
  { key: "digital_account", icon: "🔑", label: "Digital Accounts", vaultOnly: true },
  { key: "physical_location", icon: "📍", label: "Physical Locations", vaultOnly: true },
  { key: "contact", icon: "👤", label: "Important Contacts", vaultOnly: true },
  { key: "business", icon: "💼", label: "Business Interests", vaultOnly: true },
  { key: "final_wishes", icon: "📝", label: "Final Wishes", vaultOnly: true },
];

const CATEGORY_FIELDS: Record<string, Array<{ name: string; label: string; type: string; options?: string[] }>> = {
  financial_account: [
    { name: "label", label: "Label", type: "text" },
    { name: "institution", label: "Institution name", type: "text" },
    { name: "account_type", label: "Account type", type: "choice", options: ["Checking", "Savings", "Investment", "Retirement", "Other"] },
    { name: "last4", label: "Last 4 digits", type: "text" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  insurance: [
    { name: "label", label: "Label", type: "text" },
    { name: "insurance_type", label: "Insurance type", type: "choice", options: ["Life", "Long-Term Care", "Disability", "Home", "Auto", "Other"] },
    { name: "company", label: "Company name", type: "text" },
    { name: "policy_number", label: "Policy number", type: "text" },
    { name: "coverage_amount", label: "Coverage amount", type: "text" },
    { name: "beneficiary", label: "Beneficiary name", type: "text" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  digital_account: [
    { name: "label", label: "Label", type: "text" },
    { name: "platform", label: "Platform/Service", type: "text" },
    { name: "username", label: "Username or email", type: "text" },
    { name: "password", label: "Password", type: "password" },
    { name: "memorial", label: "Memorial instructions", type: "choice", options: ["Memorialize", "Delete Account", "Transfer to someone", "No preference"] },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  physical_location: [
    { name: "label", label: "Label", type: "text" },
    { name: "location_type", label: "Location type", type: "choice", options: ["Home Safe", "Safe Deposit Box", "Attorney Office", "Filing Cabinet", "Other"] },
    { name: "description", label: "Location description", type: "text" },
    { name: "access_instructions", label: "Access instructions", type: "password" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  contact: [
    { name: "label", label: "Label", type: "text" },
    { name: "contact_type", label: "Contact type", type: "choice", options: ["Attorney", "Financial Advisor", "CPA", "Insurance Agent", "Executor", "Healthcare Advocate", "Guardian", "Other"] },
    { name: "full_name", label: "Full name", type: "text" },
    { name: "firm", label: "Firm/Company", type: "text" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "email", label: "Email", type: "text" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  business: [
    { name: "label", label: "Business name", type: "text" },
    { name: "ownership_pct", label: "Your ownership %", type: "text" },
    { name: "business_type", label: "Business type", type: "choice", options: ["LLC", "S-Corp", "Partnership", "Sole Proprietor", "Other"] },
    { name: "agreement_location", label: "Operating agreement location", type: "text" },
    { name: "co_owners", label: "Co-owner names", type: "text" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  final_wishes: [
    { name: "label", label: "Title", type: "text" },
    { name: "wishes", label: "Your personal wishes and instructions", type: "textarea" },
  ],
};

const DOC_TYPE_OPTIONS = ["Will", "Trust", "Power of Attorney", "Healthcare Directive", "Deed", "Insurance Policy", "Other"];

type Screen = "pin-check" | "pin-create" | "pin-enter" | "vault" | "category" | "add-item" | "upload-doc";

export default function VaultPage() {
  const [screen, setScreen] = useState<Screen>("pin-check");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [items, setItems] = useState<VaultItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [addForm, setAddForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pinExpiry, setPinExpiry] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadDocType, setUploadDocType] = useState("Other");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const [pinRes, subRes] = await Promise.all([
        fetch("/api/vault/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check" }) }),
        fetch("/api/subscription/status"),
      ]);
      const pinData = await pinRes.json();
      const subData = await subRes.json();
      setIsSubscribed(subData.status === "active");
      setScreen(pinData.hasPin ? "pin-enter" : "pin-create");
    }
    check();
  }, []);

  // Auto-lock after 10 min
  useEffect(() => {
    if (screen !== "vault" && screen !== "category" && screen !== "add-item" && screen !== "upload-doc") return;
    if (pinExpiry === 0) return;
    const timer = setInterval(() => {
      if (Date.now() > pinExpiry) { setScreen("pin-enter"); setPin(""); }
    }, 10000);
    return () => clearInterval(timer);
  }, [screen, pinExpiry]);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/vault/items");
    const data = await res.json();
    setItems(data.items || []);
  }, []);

  async function handleCreatePin() {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { setPinError("PIN must be exactly 4 digits"); return; }
    if (pin !== confirmPin) { setPinError("PINs do not match"); return; }
    const res = await fetch("/api/vault/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", pin }) });
    if (!res.ok) { setPinError("Failed to create PIN"); return; }
    setPinExpiry(Date.now() + 10 * 60 * 1000);
    await loadItems();
    setScreen("vault");
  }

  async function handleVerifyPin() {
    const res = await fetch("/api/vault/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", pin }) });
    if (!res.ok) { setPinError("Incorrect PIN"); setPin(""); return; }
    setPinExpiry(Date.now() + 10 * 60 * 1000);
    await loadItems();
    setScreen("vault");
  }

  async function handleAddItem() {
    if (!addForm.label?.trim()) return;
    setSaving(true);
    const { label, ...rest } = addForm;
    await fetch("/api/vault/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: selectedCategory, label, data: rest }) });
    await loadItems();
    setAddForm({});
    setSaving(false);
    setScreen("category");
  }

  async function handleDelete(id: string) {
    await fetch(`/api/vault/items?id=${id}`, { method: "DELETE" });
    await loadItems();
  }

  async function handleUploadDoc() {
    if (!uploadFile || !uploadLabel.trim()) return;
    setUploading(true);
    setUploadError("");

    const form = new FormData();
    form.append("file", uploadFile);
    form.append("label", uploadLabel.trim());
    form.append("doc_type", uploadDocType);

    const res = await fetch("/api/vault/upload-document", { method: "POST", body: form });
    const data = await res.json();

    if (!res.ok) {
      setUploadError(data.error || "Upload failed. Please try again.");
      setUploading(false);
      return;
    }

    await loadItems();
    setUploadFile(null);
    setUploadLabel("");
    setUploadDocType("Other");
    setUploading(false);
    setScreen("category");
  }

  async function handleDownloadDoc(item: VaultItem) {
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/vault/download-document?item_id=${item.id}`);
      if (!res.ok) { alert("Unable to download file."); return; }
      const { url } = await res.json();
      window.open(url, "_blank");
    } finally {
      setDownloadingId(null);
    }
  }

  function getCategoryCount(key: string) { return items.filter((i) => i.category === key).length; }

  // ── PIN screens ──────────────────────────────────
  if (screen === "pin-check") {
    return <div className="flex items-center justify-center py-20"><div className="animate-pulse text-gold text-xl font-bold">Loading vault...</div></div>;
  }

  if (screen === "pin-create") {
    return (
      <div className="max-w-sm mx-auto py-16 text-center">
        <div className="flex justify-center"><div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center"><span className="text-3xl">🔐</span></div></div>
        <h1 className="mt-6 text-xl font-bold text-navy">Create Your Vault PIN</h1>
        <p className="mt-2 text-sm text-charcoal/60">Choose a 4-digit PIN to secure your vault. This is separate from your account password.</p>
        {pinError && <p className="mt-3 text-sm text-red-600">{pinError}</p>}
        <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setPinError(""); }} placeholder="Enter 4-digit PIN" className={`mt-6 w-full text-center rounded-xl border-2 border-gray-200 py-4 leading-none focus:border-gold focus:outline-none ${pin ? "text-2xl tracking-[0.5em]" : "text-sm tracking-normal"}`} />
        <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))} placeholder="Confirm PIN" className={`mt-3 w-full text-center rounded-xl border-2 border-gray-200 py-4 leading-none focus:border-gold focus:outline-none ${confirmPin ? "text-2xl tracking-[0.5em]" : "text-sm tracking-normal"}`} />
        <button onClick={handleCreatePin} disabled={pin.length !== 4 || confirmPin.length !== 4} className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">Create PIN</button>
      </div>
    );
  }

  if (screen === "pin-enter") {
    return (
      <div className="max-w-sm mx-auto py-16 text-center">
        <div className="flex justify-center"><div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center"><span className="text-3xl">🔐</span></div></div>
        <h1 className="mt-6 text-xl font-bold text-navy">Enter Your Vault PIN</h1>
        {pinError && <p className="mt-3 text-sm text-red-600">{pinError}</p>}
        <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setPinError(""); }} placeholder="4-digit PIN" className={`mt-6 w-full text-center rounded-xl border-2 border-gray-200 py-4 leading-none focus:border-gold focus:outline-none ${pin ? "text-2xl tracking-[0.5em]" : "text-sm tracking-normal"}`}
          onKeyDown={(e) => { if (e.key === "Enter" && pin.length === 4) handleVerifyPin(); }} />
        <button onClick={handleVerifyPin} disabled={pin.length !== 4} className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">Unlock Vault</button>
      </div>
    );
  }

  // ── Estate Documents: upload screen ─────────────
  if (screen === "upload-doc") {
    return (
      <div className="max-w-lg">
        <button onClick={() => { setUploadFile(null); setUploadLabel(""); setUploadError(""); setScreen("category"); }} className="flex items-center gap-1 text-sm text-navy/60 hover:text-navy mb-4">← Back</button>
        <h1 className="text-xl font-bold text-navy">Upload Signed Document</h1>
        <p className="mt-1 text-sm text-charcoal/60">Upload a PDF of your signed and executed estate document. Max 20MB.</p>

        <div className="mt-6 space-y-5">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Document Label <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              placeholder="e.g. Signed Will, April 2026"
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
            />
          </div>

          {/* Document type */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Document Type</label>
            <div className="flex flex-wrap gap-2">
              {DOC_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setUploadDocType(opt)}
                  className={`rounded-lg border-2 px-4 py-2 text-sm transition-colors ${uploadDocType === opt ? "border-gold bg-gold/10 text-navy font-medium" : "border-gray-200 text-charcoal/70 hover:border-gold/40"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">PDF File <span className="text-red-500">*</span></label>
            <label className={`flex flex-col items-center justify-center w-full h-36 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${uploadFile ? "border-gold bg-gold/5" : "border-gray-200 hover:border-gold/50 bg-gray-50"}`}>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.type !== "application/pdf") { setUploadError("Only PDF files are allowed."); return; }
                  if (f.size > 20 * 1024 * 1024) { setUploadError("File must be under 20MB."); return; }
                  setUploadError("");
                  setUploadFile(f);
                }}
              />
              {uploadFile ? (
                <div className="text-center px-4">
                  <svg className="w-8 h-8 text-gold mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="text-sm font-medium text-navy truncate max-w-[240px]">{uploadFile.name}</p>
                  <p className="text-xs text-charcoal/50 mt-0.5">{(uploadFile.size / 1024).toFixed(0)} KB, tap to change</p>
                </div>
              ) : (
                <div className="text-center px-4">
                  <svg className="w-8 h-8 text-charcoal/30 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm text-charcoal/50">Click to select a PDF</p>
                  <p className="text-xs text-charcoal/30 mt-0.5">PDF only · Max 20MB</p>
                </div>
              )}
            </label>
          </div>

          {uploadError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {uploadError}
            </div>
          )}
        </div>

        <button
          onClick={handleUploadDoc}
          disabled={uploading || !uploadFile || !uploadLabel.trim()}
          className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Uploading...
            </span>
          ) : "Upload Document"}
        </button>
      </div>
    );
  }

  // ── Category view ────────────────────────────────
  if (screen === "category") {
    const catItems = items.filter((i) => i.category === selectedCategory);
    const cat = CATEGORIES.find((c) => c.key === selectedCategory);
    const isEstateDoc = selectedCategory === "estate_document";

    return (
      <div className="max-w-4xl">
        <button onClick={() => setScreen("vault")} className="flex items-center gap-1 text-sm text-navy/60 hover:text-navy mb-4">← Back to Vault</button>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-navy">{cat?.icon} {cat?.label}</h1>
          {isEstateDoc ? (
            <button
              onClick={() => { setUploadFile(null); setUploadLabel(""); setUploadDocType("Other"); setUploadError(""); setScreen("upload-doc"); }}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload Document
            </button>
          ) : (
            <button onClick={() => { setAddForm({}); setScreen("add-item"); }} className="inline-flex items-center rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">
              + Add New
            </button>
          )}
        </div>

        {isEstateDoc && (
          <p className="mt-2 text-sm text-charcoal/50">Upload PDFs of your signed and executed estate documents to keep them securely stored in your vault.</p>
        )}

        {catItems.length === 0 ? (
          <div className="mt-10 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <span className="text-2xl">{cat?.icon}</span>
            </div>
            <p className="text-sm text-charcoal/50">
              {isEstateDoc ? "No documents uploaded yet. Upload your first signed document." : "No items yet. Add your first one."}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {catItems.map((item) => {
              const itemData = item.data as Record<string, unknown>;
              const isUploaded = !!itemData?.storage_path;
              const isAuto = !!itemData?.order_id;
              const isDownloading = downloadingId === item.id;

              return (
                <div key={item.id} className="rounded-xl bg-white border border-gray-200 p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-navy">{item.label}</p>
                      {isAuto && <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy">Generated by EstateVault</span>}
                      {isUploaded && !!itemData.doc_type && (
                        <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold font-medium">{String(itemData.doc_type)}</span>
                      )}
                    </div>
                    <p className="text-xs text-charcoal/50 mt-1">
                      {isUploaded && itemData.file_name
                        ? `${String(itemData.file_name)} · Uploaded ${new Date(item.created_at).toLocaleDateString()}`
                        : `Added ${new Date(item.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isUploaded && (
                      <button
                        onClick={() => handleDownloadDoc(item)}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-60 transition-colors"
                      >
                        {isDownloading ? (
                          <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        )}
                        {isDownloading ? "Opening..." : "Download"}
                      </button>
                    )}
                    {!isAuto && (
                      <button onClick={() => handleDelete(item.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Add item form ────────────────────────────────
  if (screen === "add-item") {
    const fields = CATEGORY_FIELDS[selectedCategory] || [];
    const cat = CATEGORIES.find((c) => c.key === selectedCategory);
    return (
      <div className="max-w-lg">
        <button onClick={() => setScreen("category")} className="flex items-center gap-1 text-sm text-navy/60 hover:text-navy mb-4">← Back</button>
        <h1 className="text-xl font-bold text-navy">Add {cat?.label?.replace(/s$/, "")}</h1>
        <div className="mt-6 space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-navy mb-1">{field.label}</label>
              {field.type === "choice" ? (
                <div className="flex flex-wrap gap-2">
                  {field.options?.map((opt) => (
                    <button key={opt} type="button" onClick={() => setAddForm((p) => ({ ...p, [field.name]: opt }))}
                      className={`rounded-lg border-2 px-4 py-2 text-sm ${addForm[field.name] === opt ? "border-gold bg-gold/10 text-navy" : "border-gray-200 text-charcoal/70 hover:border-gold/40"}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : field.type === "textarea" ? (
                <textarea value={addForm[field.name] || ""} onChange={(e) => setAddForm((p) => ({ ...p, [field.name]: e.target.value }))} rows={3}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none resize-none" />
              ) : (
                <input type={field.type === "password" ? "password" : "text"} value={addForm[field.name] || ""} onChange={(e) => setAddForm((p) => ({ ...p, [field.name]: e.target.value }))}
                  className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              )}
            </div>
          ))}
        </div>
        <button onClick={handleAddItem} disabled={saving || !addForm.label?.trim()} className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? "Saving..." : "Save Item"}
        </button>
      </div>
    );
  }

  // ── Main vault view ──────────────────────────────
  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">My Family Vault</h1>
          <p className="mt-1 text-sm text-charcoal/60">Everything your family needs, secured and organized.</p>
        </div>
        <Link href="/dashboard/vault/trustees" className="rounded-full border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors">
          Manage Emergency Access
        </Link>
      </div>

      {/* Subscription banner */}
      <div className="mt-6">
        <SubscriptionBanner onStatusLoaded={(s) => setIsSubscribed(s.status === "active")} />
      </div>

      {/* Upgrade prompt modal */}
      {showUpgradePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
            <span className="text-4xl">🔒</span>
            <h2 className="mt-4 text-lg font-bold text-navy">Vault Plan Required</h2>
            <p className="mt-2 text-sm text-charcoal/60">This section is part of the EstateVault Plan ($99/year). Upgrade to securely store and protect all your important information.</p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={async () => {
                  setShowUpgradePrompt(false);
                  const res = await fetch("/api/checkout/vault-subscription", { method: "POST" });
                  const data = await res.json();
                  if (data.url) window.location.href = data.url;
                }}
                className="w-full min-h-[44px] flex items-center justify-center rounded-full bg-gold text-sm font-semibold text-white hover:bg-gold/90 transition-colors"
              >
                Upgrade, $99/year
              </button>
              <button onClick={() => setShowUpgradePrompt(false)} className="text-sm text-charcoal/50 hover:text-charcoal transition-colors">
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category grid */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const count = getCategoryCount(cat.key);
          const requiresUpgrade = !isSubscribed;
          return (
            <button
              key={cat.key}
              onClick={() => {
                if (requiresUpgrade) { setShowUpgradePrompt(true); return; }
                setSelectedCategory(cat.key);
                setScreen("category");
              }}
              className={`relative rounded-xl p-5 text-left transition-all hover:shadow-md ${
                count > 0 ? "bg-navy text-white" : "bg-navy/5 border border-gray-200 text-navy"
              }`}
            >
              {requiresUpgrade && (
                <div className="absolute top-2.5 right-2.5 text-charcoal/30">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
              )}
              <span className="text-2xl">{cat.icon}</span>
              <p className="mt-3 text-sm font-semibold">{cat.label}</p>
              <p className={`mt-1 text-xs ${count > 0 ? "text-white/60" : "text-charcoal/50"}`}>
                {requiresUpgrade ? "Vault plan required" : count > 0 ? `${count} item${count !== 1 ? "s" : ""}` : "Empty"}
              </p>
            </button>
          );
        })}

        {/* Farewell Messages card */}
        <Link href="/dashboard/vault/farewell"
          className="rounded-xl p-5 text-left transition-all hover:shadow-md bg-navy/5 border border-gold/30 text-navy">
          <span className="text-2xl">🎥</span>
          <p className="mt-3 text-sm font-semibold">Farewell Messages</p>
          <p className="mt-1 text-xs text-charcoal/60">Video messages for loved ones</p>
        </Link>
      </div>
    </div>
  );
}
