"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function Step2VaultPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("Legacy Protection");
  const [accentColor, setAccentColor] = useState("#C9A84C");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [partnerId, setPartnerId] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      const { data: partner } = await supabase
        .from("partners")
        .select("id, tier, company_name, product_name, accent_color, logo_url")
        .eq("profile_id", user.id)
        .single();
      if (partner) {
        if (partner.tier !== "basic") {
          router.push("/pro/onboarding/step-2");
          return;
        }
        setPartnerId(partner.id);
        setCompanyName(partner.company_name || "");
        if (partner.product_name) setProductName(partner.product_name);
        if (partner.accent_color) setAccentColor(partner.accent_color);
        if (partner.logo_url) setLogoUrl(partner.logo_url);
      }
    }
    load();
  }, [router]);

  async function handleLogoUpload(file: File) {
    if (!file || !partnerId) return;
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Please upload a PNG, JPG, SVG, or WebP file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File must be under 5MB.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const filePath = `logos/${partnerId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
      if (uploadErr) {
        const { error: fallbackErr } = await supabase.storage.from("documents").upload(filePath, file, { upsert: true });
        if (fallbackErr) {
          setUploadError("Upload failed. Please try again.");
          setUploading(false);
          return;
        }
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);
        setLogoUrl(urlData.publicUrl);
        await supabase.from("partners").update({ logo_url: urlData.publicUrl }).eq("id", partnerId);
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
      setLogoUrl(urlData.publicUrl);
      await supabase.from("partners").update({ logo_url: urlData.publicUrl }).eq("id", partnerId);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleLogoUpload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleLogoUpload(file);
  }

  async function handleContinue() {
    if (!companyName.trim() || !partnerId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("partners")
      .update({
        company_name: companyName,
        product_name: productName,
        accent_color: accentColor,
        logo_url: logoUrl || null,
        onboarding_step: 3,
      })
      .eq("id", partnerId);
    router.push("/pro/onboarding/step-3-vault");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Brand Your Vault</h1>
      <p className="mt-1 text-sm text-charcoal/60">This is what your clients will see on their vault.</p>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
            />
            <p className="mt-1 text-xs text-charcoal/50">Your business name as clients will see it</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Product Name</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
            />
            <p className="mt-1 text-xs text-charcoal/50">Appears in your vault URL and client emails</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Logo Upload</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-gold/50"
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                  <p className="text-sm text-charcoal/60">Uploading...</p>
                </div>
              ) : logoUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative h-16 w-16">
                    <Image src={logoUrl} alt="Logo" fill className="rounded object-contain" unoptimized />
                  </div>
                  <p className="text-xs text-charcoal/50">Click to replace</p>
                </div>
              ) : (
                <>
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <p className="text-sm text-charcoal/60">Drag and drop or click to upload</p>
                  <p className="mt-1 text-xs text-charcoal/60">PNG, SVG, JPG, WebP, max 5MB</p>
                </>
              )}
            </div>
            {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Accent Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border-0"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="min-h-[44px] flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-navy">Live Preview</p>
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 bg-white px-4 py-3" style={{ borderBottom: `2px solid ${accentColor}` }}>
                {logoUrl ? (
                  <div className="relative h-8 w-8">
                    <Image src={logoUrl} alt="Logo" fill className="rounded object-contain" unoptimized />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-200 text-xs text-gray-500">Logo</div>
                )}
                <span className="text-sm font-bold text-navy">{productName || "Legacy Protection"}</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="bg-gray-50 px-4 py-2 text-xs text-charcoal/50">Vault Portal Preview</div>
              <div className="p-4">
                <p className="text-sm font-semibold text-navy">{companyName || "Company"}</p>
                <p className="text-xs text-charcoal/50">Secure Document Vault - powered by {productName}</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div style={{ height: 3, background: accentColor }} />
              <div className="p-4">
                <p className="text-xs text-charcoal/50">
                  Vault by <span className="font-medium text-navy">{companyName || "Company"}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={!companyName.trim() || saving || !partnerId}
        className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}
