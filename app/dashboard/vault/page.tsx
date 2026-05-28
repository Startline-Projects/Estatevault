"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import SubscriptionBanner from "@/components/dashboard/SubscriptionBanner";
import { listItems, createItem, deleteItem, type VaultCategory } from "@/lib/repos/vaultRepo";
import { downloadDocument } from "@/lib/repos/documentRepo";
import { listFarewellMessages } from "@/lib/repos/videoRepo";
import { PRICES, formatPrice } from "@/lib/orders/pricing";
import { pinAction, downloadDocument as downloadVaultDocument } from "@/lib/api-client/vault";
import { getStatus as getSubStatus, sync as syncSub } from "@/lib/api-client/subscription";
import { checkoutVaultSubscription } from "@/lib/api-client/checkout";

import VaultPinScreen from "@/components/vault/VaultPinScreen";
import VaultItemDetailModal from "@/components/vault/VaultItemDetailModal";
import VaultUploadForm from "@/components/vault/VaultUploadForm";
import VaultAddItemForm from "@/components/vault/VaultAddItemForm";
import VaultCategoryView from "@/components/vault/VaultCategoryView";
import VaultMainGrid from "@/components/vault/VaultMainGrid";
import {
  CATEGORIES,
  CATEGORY_FIELDS,
  type VaultItem,
  type Screen,
} from "@/components/vault/vault-constants";

const SCREEN_STORAGE_KEY = "vault:screen";
const CATEGORY_STORAGE_KEY = "vault:selected-category";
const RESTORABLE_SCREENS = new Set<Screen>(["vault", "category", "add-item", "upload-doc"]);

export default function VaultPage() {
  const router = useRouter();
  const initRef = useRef(false);
  const [screen, setScreen] = useState<Screen>("pin-check");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [items, setItems] = useState<VaultItem[]>([]);
  const [farewellCount, setFarewellCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [addForm, setAddForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pinExpiry, setPinExpiry] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadDocType, setUploadDocType] = useState("Other");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<VaultItem | null>(null);

  // -- Init: check PIN + subscription status --
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    async function check() {
      const justSubscribed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("subscribed") === "true";
      const [pinResult, subResult] = await Promise.all([
        pinAction({ action: "check" }),
        getSubStatus(),
      ]);
      const pinData = pinResult.data as Record<string, unknown> | undefined;
      let subStatus = subResult.data?.status;
      if (justSubscribed || subStatus !== "active") {
        try {
          const { data: syncData } = await syncSub();
          if (syncData?.status === "active") subStatus = "active";
        } catch { /* ignore */ }
      }
      setIsSubscribed(subStatus === "active");
      const cachedExpiry = typeof window !== "undefined" ? Number(sessionStorage.getItem("vault:pin-expiry") || 0) : 0;
      if (pinData?.hasPin && cachedExpiry > Date.now()) {
        setPinExpiry(cachedExpiry);
        await loadItems();
        const savedScreen = typeof window !== "undefined" ? sessionStorage.getItem(SCREEN_STORAGE_KEY) : null;
        const savedCategory = typeof window !== "undefined" ? sessionStorage.getItem(CATEGORY_STORAGE_KEY) : null;
        if (savedScreen && RESTORABLE_SCREENS.has(savedScreen as Screen)) {
          if (savedCategory) setSelectedCategory(savedCategory);
          setScreen(savedScreen as Screen);
        } else { setScreen("vault"); }
      } else {
        if (typeof window !== "undefined") { sessionStorage.removeItem("vault:pin-expiry"); sessionStorage.removeItem(SCREEN_STORAGE_KEY); sessionStorage.removeItem(CATEGORY_STORAGE_KEY); }
        setScreen(pinData?.hasPin ? "pin-enter" : "pin-create");
      }
      if (justSubscribed && typeof window !== "undefined") { const url = new URL(window.location.href); url.searchParams.delete("subscribed"); window.history.replaceState({}, "", url.toString()); }
    }
    check();
  }, [router]);

  // -- Persist screen + category for tab restore --
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (RESTORABLE_SCREENS.has(screen)) {
      sessionStorage.setItem(SCREEN_STORAGE_KEY, screen);
      if (selectedCategory) sessionStorage.setItem(CATEGORY_STORAGE_KEY, selectedCategory);
      else sessionStorage.removeItem(CATEGORY_STORAGE_KEY);
    }
  }, [screen, selectedCategory]);

  // -- Auto-lock after 10 min --
  useEffect(() => {
    if (screen !== "vault" && screen !== "category" && screen !== "add-item" && screen !== "upload-doc") return;
    if (pinExpiry === 0) return;
    const timer = setInterval(() => {
      if (Date.now() > pinExpiry) {
        setScreen("pin-enter"); setPin("");
        if (typeof window !== "undefined") { sessionStorage.removeItem("vault:pin-expiry"); sessionStorage.removeItem(SCREEN_STORAGE_KEY); sessionStorage.removeItem(CATEGORY_STORAGE_KEY); }
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [screen, pinExpiry]);

  const handleSubStatusLoaded = useCallback((s: { status: string }) => setIsSubscribed(s.status === "active"), []);

  const loadItems = useCallback(async () => {
    try {
      const list = await listItems();
      const uploadedOnly = list.filter((i) => !(i.data as Record<string, unknown>)?.order_id);
      setItems(uploadedOnly.map((i) => ({ id: i.id, category: i.category, label: i.label, data: i.storagePath ? { ...i.data, storage_path: i.storagePath } : i.data, created_at: i.createdAt, encrypted: i.encrypted, storage_path: i.storagePath })));
    } catch (e) { console.error("vault list failed:", (e as Error).message); }
    try { const fw = await listFarewellMessages(); setFarewellCount(fw.length); } catch (e) { console.error("farewell list failed:", (e as Error).message); }
  }, []);

  useEffect(() => { if (screen !== "vault" && screen !== "category") return; void loadItems(); }, [screen, loadItems]);

  // -- Handlers --
  async function handleCreatePin() {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) { setPinError("PIN must be exactly 6 digits"); return; }
    if (pin !== confirmPin) { setPinError("PINs do not match"); return; }
    const { error: err } = await pinAction({ action: "create", pin });
    if (err) { setPinError("Failed to create PIN"); return; }
    const expiry = Date.now() + 10 * 60 * 1000; setPinExpiry(expiry);
    if (typeof window !== "undefined") sessionStorage.setItem("vault:pin-expiry", String(expiry));
    await loadItems(); setScreen("vault");
  }

  async function handleVerifyPin() {
    const { error: err } = await pinAction({ action: "verify", pin });
    if (err) { setPinError("Incorrect PIN"); setPin(""); return; }
    const expiry = Date.now() + 10 * 60 * 1000; setPinExpiry(expiry);
    if (typeof window !== "undefined") sessionStorage.setItem("vault:pin-expiry", String(expiry));
    await loadItems(); setScreen("vault");
  }

  async function handleAddItem() {
    if (!addForm.label?.trim()) return;
    setSaving(true);
    try { const { label, ...rest } = addForm; await createItem({ category: selectedCategory as VaultCategory, label, data: rest }); await loadItems(); setAddForm({}); setScreen("category"); }
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

  async function handleUpgradeCheckout() {
    setShowUpgradePrompt(false);
    const { data } = await checkoutVaultSubscription();
    if (data?.url) window.location.href = data.url;
  }

  // -- Render --
  if (screen === "pin-check" || screen === "pin-create" || screen === "pin-enter") {
    return <VaultPinScreen screen={screen} pin={pin} confirmPin={confirmPin} pinError={pinError} onPinChange={setPin} onConfirmPinChange={setConfirmPin} onPinErrorClear={() => setPinError("")} onCreatePin={handleCreatePin} onVerifyPin={handleVerifyPin} />;
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

  if (screen === "add-item") {
    return <VaultAddItemForm selectedCategory={selectedCategory} addForm={addForm} saving={saving} onFormChange={setAddForm} onSave={handleAddItem} onBack={() => setScreen("category")} categories={CATEGORIES} categoryFields={CATEGORY_FIELDS} />;
  }

  return (
    <VaultMainGrid
      items={items}
      farewellCount={farewellCount}
      isSubscribed={isSubscribed}
      showUpgradePrompt={showUpgradePrompt}
      formattedPrice={formatPrice(PRICES.vaultSubscriptionYear)}
      categories={CATEGORIES}
      subscriptionBanner={<SubscriptionBanner onStatusLoaded={handleSubStatusLoaded} />}
      onManageAccess={() => { if (!isSubscribed) { setShowUpgradePrompt(true); return; } router.push("/dashboard/vault/trustees"); }}
      onShowUpgrade={() => setShowUpgradePrompt(true)}
      onDismissUpgrade={() => setShowUpgradePrompt(false)}
      onUpgrade={handleUpgradeCheckout}
      onSelectCategory={(key) => { setSelectedCategory(key); setScreen("category"); }}
      onFarewellClick={() => { if (!isSubscribed) { setShowUpgradePrompt(true); return; } router.push("/dashboard/vault/farewell"); }}
    />
  );
}
