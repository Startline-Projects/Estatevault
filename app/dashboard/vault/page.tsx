"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import SubscriptionBanner from "@/components/dashboard/SubscriptionBanner";
import { listItems, createItem, deleteItem, type VaultCategory } from "@/lib/repos/vaultRepo";
import { downloadDocument } from "@/lib/repos/documentRepo";
import { listFarewellMessages } from "@/lib/repos/videoRepo";
import { PRICES, formatPrice } from "@/lib/orders/pricing";
import { pinAction, downloadDocument as downloadVaultDocument } from "@/lib/api-client/vault";
import { getStatus as getSubStatus, sync as syncSub, type SubscriptionStatus } from "@/lib/api-client/subscription";
import { checkoutVaultSubscription } from "@/lib/api-client/checkout";

import VaultPinScreen from "@/components/vault/VaultPinScreen";
import VaultSubscribeScreen from "@/components/vault/VaultSubscribeScreen";
import LoadingScreen from "@/components/ui/LoadingScreen";
import VaultItemDetailModal from "@/components/vault/VaultItemDetailModal";
import VaultUploadForm from "@/components/vault/VaultUploadForm";
import VaultAddItemForm from "@/components/vault/VaultAddItemForm";
import VaultCategoryView from "@/components/vault/VaultCategoryView";
import VaultMainGrid from "@/components/vault/VaultMainGrid";
import VaultFarewellView from "@/components/vault/VaultFarewellView";
import VaultTrusteesView from "@/components/vault/VaultTrusteesView";
import {
  CATEGORIES,
  CATEGORY_FIELDS,
  type VaultItem,
  type Screen,
} from "@/components/vault/vault-constants";

// How long a PIN unlock stays valid (same-tab) before the vault re-prompts.
const PIN_UNLOCK_MS = 2 * 60 * 1000;
const SCREEN_STORAGE_KEY = "vault:screen";
const CATEGORY_STORAGE_KEY = "vault:selected-category";
const DRAFT_STORAGE_KEY = "vault:add-draft";
const PIN_EXPIRY_KEY = "vault:pin-expiry";
const RESTORABLE_SCREENS = new Set<Screen>(["vault", "category", "add-item", "upload-doc", "farewell", "trustees"]);
// Don't bump the sliding-unlock timer more than once per this window (avoids re-render storms).
const ACTIVITY_THROTTLE_MS = 30 * 1000;

export default function VaultPage() {
  const initRef = useRef(false);
  const lastBumpRef = useRef(0);
  const [screen, setScreen] = useState<Screen>("pin-check");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [farewellCount, setFarewellCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [addForm, setAddForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pinExpiry, setPinExpiry] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoaded, setSubLoaded] = useState(false);
  const [subData, setSubData] = useState<SubscriptionStatus | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadDocType, setUploadDocType] = useState("Other");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<VaultItem | null>(null);

  // -- Init: PIN gate decides the screen; subscription loads in the background --
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const justSubscribed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("subscribed") === "true";

    // 1a. Optimistic restore from the cached unlock — SYNCHRONOUS so returning to
    //     this route (e.g. from /farewell) shows the vault instantly with no
    //     network-gated flash. The PIN check below only confirms in the background.
    const cachedExpiry = typeof window !== "undefined" ? Number(sessionStorage.getItem(PIN_EXPIRY_KEY) || 0) : 0;
    const restoredFromCache = cachedExpiry > Date.now();
    if (restoredFromCache) {
      setPinExpiry(cachedExpiry);
      const savedScreen = typeof window !== "undefined" ? sessionStorage.getItem(SCREEN_STORAGE_KEY) : null;
      const savedCategory = typeof window !== "undefined" ? sessionStorage.getItem(CATEGORY_STORAGE_KEY) : null;
      if (savedScreen && RESTORABLE_SCREENS.has(savedScreen as Screen)) {
        if (savedCategory) setSelectedCategory(savedCategory);
        if (savedScreen === "add-item") {
          const draftRaw = typeof window !== "undefined" ? sessionStorage.getItem(DRAFT_STORAGE_KEY) : null;
          if (draftRaw) { try { setAddForm(JSON.parse(draftRaw)); } catch { /* ignore bad draft */ } }
        }
        setScreen(savedScreen as Screen);
      } else { setScreen("vault"); }
    }

    // 1b. Confirm PIN + subscription together, then pick the gate screen. A brand-new
    //     user (no PIN) who isn't subscribed must subscribe BEFORE creating a PIN, so the
    //     no-PIN branch waits on subscription status. Existing-PIN users are unaffected
    //     (a lapsed sub still unlocks to view via pin-enter).
    (async () => {
      const [{ data: pinRaw }, { data: subRaw }] = await Promise.all([
        pinAction({ action: "check" }),
        getSubStatus(),
      ]);
      const pinData = pinRaw as Record<string, unknown> | undefined;
      const hasPin = Boolean(pinData?.hasPin);

      let status: SubscriptionStatus | null = subRaw ?? null;
      if (justSubscribed && status?.status !== "active") {
        try { const { data: syncData } = await syncSub(); if (syncData?.status === "active") status = { ...(status ?? { status: "active" }), status: "active" }; } catch { /* ignore */ }
      }
      // Honor cancelled-but-still-paid access: canUseFarewell reflects real access.
      const active = status?.status === "active" || status?.canUseFarewell === true;
      setSubData(status);
      setIsSubscribed(active);
      setSubLoaded(true);

      if (hasPin && restoredFromCache) return; // optimistic restore stands
      if (typeof window !== "undefined") { sessionStorage.removeItem(PIN_EXPIRY_KEY); sessionStorage.removeItem(SCREEN_STORAGE_KEY); sessionStorage.removeItem(CATEGORY_STORAGE_KEY); }
      if (hasPin) { setScreen("pin-enter"); return; }
      setScreen(active ? "pin-create" : "subscribe");
    })();

    if (justSubscribed && typeof window !== "undefined") { const url = new URL(window.location.href); url.searchParams.delete("subscribed"); window.history.replaceState({}, "", url.toString()); }
  }, []);

  // -- Persist screen + category for tab restore --
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (RESTORABLE_SCREENS.has(screen)) {
      sessionStorage.setItem(SCREEN_STORAGE_KEY, screen);
      if (selectedCategory) sessionStorage.setItem(CATEGORY_STORAGE_KEY, selectedCategory);
      else sessionStorage.removeItem(CATEGORY_STORAGE_KEY);
    }
  }, [screen, selectedCategory]);

  // -- Persist the add-item draft so a lock/restore doesn't lose typed values --
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (screen !== "add-item") return;
    if (Object.keys(addForm).length === 0) { sessionStorage.removeItem(DRAFT_STORAGE_KEY); return; }
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(addForm));
  }, [screen, addForm]);

  // -- Auto-lock once the PIN unlock window expires (idle, not absolute) --
  useEffect(() => {
    if (!RESTORABLE_SCREENS.has(screen)) return;
    if (pinExpiry === 0) return;
    const timer = setInterval(() => {
      if (Date.now() > pinExpiry) {
        setScreen("pin-enter"); setPin("");
        if (typeof window !== "undefined") { sessionStorage.removeItem(PIN_EXPIRY_KEY); sessionStorage.removeItem(SCREEN_STORAGE_KEY); sessionStorage.removeItem(CATEGORY_STORAGE_KEY); }
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [screen, pinExpiry]);

  // -- Sliding unlock: user activity pushes the expiry forward so we never lock mid-entry --
  const bumpExpiry = useCallback(() => {
    const now = Date.now();
    if (now - lastBumpRef.current < ACTIVITY_THROTTLE_MS) return;
    lastBumpRef.current = now;
    const expiry = now + PIN_UNLOCK_MS;
    setPinExpiry(expiry);
    if (typeof window !== "undefined") sessionStorage.setItem(PIN_EXPIRY_KEY, String(expiry));
  }, []);

  useEffect(() => {
    if (!RESTORABLE_SCREENS.has(screen)) return;
    if (pinExpiry === 0) return;
    const events = ["keydown", "pointerdown", "input", "focusin"] as const;
    events.forEach((e) => window.addEventListener(e, bumpExpiry));
    return () => events.forEach((e) => window.removeEventListener(e, bumpExpiry));
  }, [screen, pinExpiry, bumpExpiry]);

  const handleSubStatusLoaded = useCallback((s: { status: string; canUseFarewell?: boolean }) => { setIsSubscribed(s.status === "active" || s.canUseFarewell === true); setSubLoaded(true); }, []);

  const loadItems = useCallback(async () => {
    const [listRes, fwRes] = await Promise.allSettled([listItems(), listFarewellMessages()]);
    if (listRes.status === "fulfilled") {
      const uploadedOnly = listRes.value.filter((i) => !(i.data as Record<string, unknown>)?.order_id);
      setItems(uploadedOnly.map((i) => ({ id: i.id, category: i.category, label: i.label, data: i.storagePath ? { ...i.data, storage_path: i.storagePath } : i.data, created_at: i.createdAt, encrypted: i.encrypted, storage_path: i.storagePath })));
    } else { console.error("vault list failed:", (listRes.reason as Error)?.message); }
    if (fwRes.status === "fulfilled") { setFarewellCount(fwRes.value.length); }
    else { console.error("farewell list failed:", (fwRes.reason as Error)?.message); }
    setItemsLoaded(true);
  }, []);

  useEffect(() => { if (screen !== "vault" && screen !== "category") return; void loadItems(); }, [screen, loadItems]);

  // -- Handlers --
  async function handleCreatePin() {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) { setPinError("PIN must be exactly 6 digits"); return; }
    if (pin !== confirmPin) { setPinError("PINs do not match"); return; }
    setVerifying(true);
    const { error: err } = await pinAction({ action: "create", pin });
    if (err) { setPinError("Failed to create PIN"); setVerifying(false); return; }
    const expiry = Date.now() + PIN_UNLOCK_MS; setPinExpiry(expiry);
    if (typeof window !== "undefined") sessionStorage.setItem(PIN_EXPIRY_KEY, String(expiry));
    // Show the grid immediately; the screen-change effect loads items in the background.
    setScreen("vault"); setVerifying(false);
  }

  async function handleVerifyPin() {
    setVerifying(true);
    const { error: err } = await pinAction({ action: "verify", pin });
    if (err) { setPinError("Incorrect PIN"); setPin(""); setVerifying(false); return; }
    const expiry = Date.now() + PIN_UNLOCK_MS; setPinExpiry(expiry);
    if (typeof window !== "undefined") sessionStorage.setItem(PIN_EXPIRY_KEY, String(expiry));
    // Show the grid immediately; the screen-change effect loads items in the background.
    setScreen("vault"); setVerifying(false);
  }

  async function handleAddItem() {
    if (!addForm.label?.trim()) return;
    setSaving(true);
    try { const { label, ...rest } = addForm; await createItem({ category: selectedCategory as VaultCategory, label, data: rest }); await loadItems(); setAddForm({}); if (typeof window !== "undefined") sessionStorage.removeItem(DRAFT_STORAGE_KEY); setScreen("category"); }
    catch (e) { console.error("create item failed:", (e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (deletingId) return; setDeletingId(id);
    try { await deleteItem(id); await loadItems(); } catch (e) { console.error("delete failed:", (e as Error).message); } finally { setDeletingId(null); }
  }

  async function handleUploadDoc() {
    if (!uploadFile || !uploadLabel.trim()) return;
    if (uploadFile.type !== "application/pdf") { setUploadError("Only PDF files are allowed."); return; }
    if (uploadFile.size > 20 * 1024 * 1024) { setUploadError("File must be under 20MB."); return; }
    setUploading(true); setUploadError("");
    try { const { uploadDocument } = await import("@/lib/repos/documentRepo"); await uploadDocument({ file: uploadFile, label: uploadLabel.trim(), docType: uploadDocType }); await loadItems(); setUploadFile(null); setUploadLabel(""); setUploadDocType("Other"); setScreen("category"); }
    catch (err) { setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again."); }
    finally { setUploading(false); }
  }

  async function handleDownloadDoc(item: VaultItem) {
    setDownloadingId(item.id);
    try {
      if (item.encrypted && item.storage_path) {
        const blob = await downloadDocument({ id: item.id, category: item.category as VaultCategory, label: item.label, data: item.data, storagePath: item.storage_path, encrypted: true, createdAt: item.created_at });
        const url = URL.createObjectURL(blob);
        const fileName = (item.data as { file_name?: string })?.file_name || `${item.label || "document"}.pdf`;
        const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000); return;
      }
      const { data: dlData, error: dlErr } = await downloadVaultDocument(item.id);
      if (dlErr || !dlData?.url) { alert("Unable to download file."); return; }
      window.open(dlData.url, "_blank");
    } catch (e) { alert(`Download failed: ${(e as Error).message}`); } finally { setDownloadingId(null); }
  }

  // Bulk-export every vault document so the owner can save assets before a
  // cancelled subscription lapses; reuses the per-item (E2EE-decrypting) path.
  async function handleExportAll() {
    if (exportingAll) return;
    const docs = items.filter((i) => i.storage_path);
    if (docs.length === 0) { alert("No documents to download yet."); return; }
    setExportingAll(true);
    try { for (const item of docs) { await handleDownloadDoc(item); await new Promise((r) => setTimeout(r, 400)); } }
    finally { setExportingAll(false); }
  }

  async function handleUpgradeCheckout() {
    setShowUpgradePrompt(false);
    setCheckingOut(true);
    const { data } = await checkoutVaultSubscription();
    if (data?.url) window.location.href = data.url;
    else setCheckingOut(false);
  }

  // -- Render --
  if (screen === "subscribe") {
    return <VaultSubscribeScreen formattedPrice={formatPrice(PRICES.vaultSubscriptionYear)} submitting={checkingOut} onSubscribe={handleUpgradeCheckout} />;
  }

  if (screen === "pin-check") {
    return <LoadingScreen message="Unlocking your vault…" />;
  }

  if (screen === "pin-create" || screen === "pin-enter") {
    return <VaultPinScreen screen={screen} pin={pin} confirmPin={confirmPin} pinError={pinError} submitting={verifying} onPinChange={setPin} onConfirmPinChange={setConfirmPin} onPinErrorClear={() => setPinError("")} onCreatePin={handleCreatePin} onVerifyPin={handleVerifyPin} />;
  }

  if (screen === "upload-doc") {
    return <VaultUploadForm uploadFile={uploadFile} uploadLabel={uploadLabel} uploadDocType={uploadDocType} uploading={uploading} uploadError={uploadError} onFileChange={setUploadFile} onLabelChange={setUploadLabel} onDocTypeChange={setUploadDocType} onUpload={handleUploadDoc} onBack={() => { setUploadFile(null); setUploadLabel(""); setUploadError(""); setScreen("category"); }} onUploadErrorChange={setUploadError} />;
  }

  if (screen === "category") {
    return (
      <>
        <VaultCategoryView selectedCategory={selectedCategory} items={items} downloadingId={downloadingId} deletingId={deletingId} categories={CATEGORIES} categoryFields={CATEGORY_FIELDS} onBack={() => setScreen("vault")} onAddItem={() => { setAddForm({}); setScreen("add-item"); }} onUploadDoc={() => { setUploadFile(null); setUploadLabel(""); setUploadDocType("Other"); setUploadError(""); setScreen("upload-doc"); }} onViewItem={setViewItem} onDownloadDoc={handleDownloadDoc} onDeleteItem={handleDelete} />
        <VaultItemDetailModal item={viewItem} categoryFields={CATEGORY_FIELDS} onClose={() => setViewItem(null)} />
      </>
    );
  }

  if (screen === "farewell") {
    return <VaultFarewellView onBack={() => setScreen("vault")} />;
  }

  if (screen === "trustees") {
    return <VaultTrusteesView onBack={() => setScreen("vault")} />;
  }

  if (screen === "add-item") {
    return <VaultAddItemForm selectedCategory={selectedCategory} addForm={addForm} saving={saving} onFormChange={setAddForm} onSave={handleAddItem} onBack={() => { setAddForm({}); if (typeof window !== "undefined") sessionStorage.removeItem(DRAFT_STORAGE_KEY); setScreen("category"); }} categories={CATEGORIES} categoryFields={CATEGORY_FIELDS} />;
  }

  // Hold the grid until subscription status is known — avoids flashing the locked
  // "Vault plan required" state before we know whether the user is subscribed.
  if (!subLoaded) {
    return <LoadingScreen message="Loading your vault…" />;
  }

  return (
    <VaultMainGrid
      items={items}
      itemsLoaded={itemsLoaded}
      farewellCount={farewellCount}
      isSubscribed={isSubscribed}
      showUpgradePrompt={showUpgradePrompt}
      formattedPrice={formatPrice(PRICES.vaultSubscriptionYear)}
      categories={CATEGORIES}
      subscriptionBanner={<SubscriptionBanner status={subData} onStatusLoaded={handleSubStatusLoaded} />}
      showExportAll={subData?.status === "cancelled" && subData?.canUseFarewell === true}
      exportingAll={exportingAll}
      onExportAll={handleExportAll}
      onManageAccess={() => { if (!isSubscribed) { setShowUpgradePrompt(true); return; } setScreen("trustees"); }}
      onShowUpgrade={() => setShowUpgradePrompt(true)}
      onDismissUpgrade={() => setShowUpgradePrompt(false)}
      onUpgrade={handleUpgradeCheckout}
      onSelectCategory={(key) => { setSelectedCategory(key); setScreen("category"); }}
      onFarewellClick={() => { if (!isSubscribed) { setShowUpgradePrompt(true); return; } setScreen("farewell"); }}
    />
  );
}
