"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface VaultItem {
  id: string;
  category: string;
  label: string;
  data: Record<string, unknown>;
  created_at: string;
}

const CATEGORIES = [
  { key: "estate_document", icon: "📄", label: "Estate Documents" },
  { key: "financial_account", icon: "🏦", label: "Financial Accounts" },
  { key: "insurance", icon: "🛡", label: "Insurance Policies" },
  { key: "digital_account", icon: "🔑", label: "Digital Accounts" },
  { key: "physical_location", icon: "📍", label: "Physical Locations" },
  { key: "contact", icon: "👤", label: "Important Contacts" },
  { key: "business", icon: "💼", label: "Business Interests" },
  { key: "final_wishes", icon: "📝", label: "Final Wishes" },
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
  estate_document: [
    { name: "label", label: "Label", type: "text" },
    { name: "doc_type", label: "Document type", type: "choice", options: ["Will", "Trust", "Power of Attorney", "Healthcare Directive", "Deed", "Insurance Policy", "Other"] },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
};

type Screen = "pin-check" | "pin-create" | "pin-enter" | "vault" | "category" | "add-item";

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

  // Check if PIN exists
  useEffect(() => {
    async function check() {
      const res = await fetch("/api/vault/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check" }) });
      const data = await res.json();
      setScreen(data.hasPin ? "pin-enter" : "pin-create");
    }
    check();
  }, []);

  // Auto-lock after 10 min
  useEffect(() => {
    if (screen !== "vault" && screen !== "category" && screen !== "add-item") return;
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
        <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setPinError(""); }} placeholder="Enter 4-digit PIN" className="mt-6 w-full text-center text-2xl tracking-[0.5em] rounded-xl border-2 border-gray-200 py-3 focus:border-gold focus:outline-none" />
        <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))} placeholder="Confirm PIN" className="mt-3 w-full text-center text-2xl tracking-[0.5em] rounded-xl border-2 border-gray-200 py-3 focus:border-gold focus:outline-none" />
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
        <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setPinError(""); }} placeholder="4-digit PIN" className="mt-6 w-full text-center text-2xl tracking-[0.5em] rounded-xl border-2 border-gray-200 py-3 focus:border-gold focus:outline-none"
          onKeyDown={(e) => { if (e.key === "Enter" && pin.length === 4) handleVerifyPin(); }} />
        <button onClick={handleVerifyPin} disabled={pin.length !== 4} className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">Unlock Vault</button>
      </div>
    );
  }

  // ── Category view ────────────────────────────────
  if (screen === "category") {
    const catItems = items.filter((i) => i.category === selectedCategory);
    const cat = CATEGORIES.find((c) => c.key === selectedCategory);
    return (
      <div className="max-w-4xl">
        <button onClick={() => setScreen("vault")} className="flex items-center gap-1 text-sm text-navy/60 hover:text-navy mb-4">← Back to Vault</button>
        <h1 className="text-2xl font-bold text-navy">{cat?.icon} {cat?.label}</h1>
        <button onClick={() => { setAddForm({}); setScreen("add-item"); }} className="mt-4 inline-flex items-center rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90">+ Add New</button>
        {catItems.length === 0 ? (
          <p className="mt-8 text-sm text-charcoal/50 text-center">No items yet. Add your first one.</p>
        ) : (
          <div className="mt-6 space-y-3">
            {catItems.map((item) => {
              const isAuto = !!(item.data as Record<string, unknown>)?.order_id;
              return (
                <div key={item.id} className="rounded-xl bg-white border border-gray-200 p-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-navy">{item.label}</p>
                      {isAuto && <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy">Generated by EstateVault</span>}
                    </div>
                    <p className="text-xs text-charcoal/50 mt-1">Added {new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                  {!isAuto && <button onClick={() => handleDelete(item.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>}
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
          <p className="mt-1 text-sm text-charcoal/60">Everything your family needs — secured and organized.</p>
        </div>
        <Link href="/dashboard/vault/trustees" className="rounded-full border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors">
          Manage Emergency Access
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const count = getCategoryCount(cat.key);
          return (
            <button key={cat.key} onClick={() => { setSelectedCategory(cat.key); setScreen("category"); }}
              className={`rounded-xl p-5 text-left transition-all hover:shadow-md ${count > 0 ? "bg-navy text-white" : "bg-navy/5 border border-gray-200 text-navy"}`}>
              <span className="text-2xl">{cat.icon}</span>
              <p className="mt-3 text-sm font-semibold">{cat.label}</p>
              <p className={`mt-1 text-xs ${count > 0 ? "text-white/60" : "text-charcoal/50"}`}>
                {count > 0 ? `${count} item${count !== 1 ? "s" : ""}` : "Empty"}
              </p>
            </button>
          );
        })}

        {/* Farewell Messages card */}
        <Link href="/dashboard/vault/farewell"
          className="rounded-xl p-5 text-left transition-all hover:shadow-md bg-[#1C3557]/5 border border-[#C9A84C]/30 text-[#1C3557]">
          <span className="text-2xl">🎥</span>
          <p className="mt-3 text-sm font-semibold">Farewell Messages</p>
          <p className="mt-1 text-xs text-[#2D2D2D]/50">Video messages for loved ones</p>
        </Link>
      </div>
    </div>
  );
}
