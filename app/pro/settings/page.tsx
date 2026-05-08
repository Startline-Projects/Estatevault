"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { normalizeBusinessDomain } from "@/lib/hosts";

interface PartnerData {
  id: string;
  tier: string;
  company_name: string;
  product_name: string;
  accent_color: string;
  logo_url: string | null;
  business_url: string;
  partner_slug: string;
  sender_name: string;
  sender_email: string;
  stripe_account_id: string | null;
  professional_type: string | null;
  has_inhouse_estate_attorney: boolean;
  inhouse_review_attorney_id: string | null;
  custom_review_fee: number | null;
  vault_tagline: string | null;
  vault_theme: string | null;
  vault_subdomain: string | null;
  profiles: { full_name: string; email: string } | null;
}

type SectionKey = "plan" | "brand" | "pricing" | "domain" | "email" | "payouts" | "team" | "account" | "attorney_review" | "vault_branding";

export default function ProSettingsPage() {
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");

  // Editable fields
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("");
  const [accentColor, setAccentColor] = useState("#C9A84C");
  const [businessUrl, setBusinessUrl] = useState("");
  const [partnerSlug, setPartnerSlug] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [reviewFee, setReviewFee] = useState(300);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainError, setDomainError] = useState("");
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeConnectSuccess, setStripeConnectSuccess] = useState(false);
  const searchParams = useSearchParams();
  const [savedSubdomain, setSavedSubdomain] = useState("");
  const [domainVerifying, setDomainVerifying] = useState(false);
  const [domainVerifyStatus, setDomainVerifyStatus] = useState<"idle" | "verified" | "pending" | "wrong">("idle");
  const [domainVerifyMessage, setDomainVerifyMessage] = useState("");
  const [copiedDns, setCopiedDns] = useState(false);
  const [vaultTagline, setVaultTagline] = useState("");
  const [vaultTheme, setVaultTheme] = useState<"light" | "dark">("light");
  const [vaultSubdomainDisplay, setVaultSubdomainDisplay] = useState("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("partners")
        .select(
          "id, tier, company_name, product_name, accent_color, logo_url, business_url, partner_slug, sender_name, sender_email, stripe_account_id, professional_type, has_inhouse_estate_attorney, inhouse_review_attorney_id, custom_review_fee, vault_tagline, vault_theme, vault_subdomain, profiles!profile_id(full_name, email)"
        )
        .eq("profile_id", user.id)
        .single();

      if (data) {
        const p = data as unknown as PartnerData & { subdomain?: string; domain_verified?: boolean };
        setPartner(p);
        setCompanyName(p.company_name || "");
        setProductName(p.product_name || "Legacy Protection");
        setAccentColor(p.accent_color || "#C9A84C");
        setBusinessUrl(p.business_url || "");
        setPartnerSlug(p.partner_slug || "");
        setSenderName(p.sender_name || "");
        setSenderEmail(p.sender_email || "");
        setFullName(p.profiles?.full_name || "");
        setEmail(p.profiles?.email || "");
        setReviewFee(p.custom_review_fee ? p.custom_review_fee / 100 : 300);
        if (p.subdomain) {
          setSavedSubdomain(p.subdomain);
          if (p.domain_verified) setDomainVerifyStatus("verified");
        }
        if (p.logo_url) setLogoUrl(p.logo_url);
        if (p.vault_tagline) setVaultTagline(p.vault_tagline);
        if (p.vault_theme) setVaultTheme(p.vault_theme as "light" | "dark");
        if (p.vault_subdomain) setVaultSubdomainDisplay(p.vault_subdomain);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (searchParams.get("stripe_connect") === "success") {
      setStripeConnectSuccess(true);
    }
  }, [searchParams]);

  async function handleStripeConnect() {
    setConnectingStripe(true);
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setConnectingStripe(false);
    }
  }

  function toggleSection(key: SectionKey) {
    setOpenSection(openSection === key ? null : key);
    setSaveSuccess("");
  }

  function cancelSection() {
    if (!partner) return;
    setCompanyName(partner.company_name || "");
    setProductName(partner.product_name || "Legacy Protection");
    setAccentColor(partner.accent_color || "#C9A84C");
    setBusinessUrl(partner.business_url || "");
    setPartnerSlug(partner.partner_slug || "");
    setSenderName(partner.sender_name || "");
    setSenderEmail(partner.sender_email || "");
    setFullName(partner.profiles?.full_name || "");
    setEmail(partner.profiles?.email || "");
    setVaultTagline(partner.vault_tagline || "");
    setVaultTheme((partner.vault_theme as "light" | "dark") || "light");
    setOpenSection(null);
  }

  async function saveBrand() {
    if (!partner) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("partners")
      .update({ company_name: companyName, product_name: productName, accent_color: accentColor, logo_url: logoUrl || null })
      .eq("id", partner.id);
    setPartner({ ...partner, company_name: companyName, product_name: productName, accent_color: accentColor, logo_url: logoUrl || null });
    setSaving(false);
    setSaveSuccess("brand");
    setTimeout(() => setSaveSuccess(""), 2000);
  }

  async function handleLogoUpload(file: File) {
    if (!partner) return;
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Use PNG, JPG, SVG, or WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Max 5MB.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const filePath = `logos/${partner.id}-${Date.now()}.${ext}`;

      let publicUrl = "";
      const { error: uploadErr } = await supabase.storage
        .from("logos")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) {
        const { error: fallbackErr } = await supabase.storage
          .from("documents")
          .upload(filePath, file, { upsert: true });
        if (fallbackErr) {
          setUploadError("Upload failed. Try again.");
          setUploading(false);
          return;
        }
        publicUrl = supabase.storage.from("documents").getPublicUrl(filePath).data.publicUrl;
      } else {
        publicUrl = supabase.storage.from("logos").getPublicUrl(filePath).data.publicUrl;
      }

      await supabase.from("partners").update({ logo_url: publicUrl }).eq("id", partner.id);
      setLogoUrl(publicUrl);
      setPartner({ ...partner, logo_url: publicUrl });
    } catch {
      setUploadError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    if (!partner) return;
    const supabase = createClient();
    await supabase.from("partners").update({ logo_url: null }).eq("id", partner.id);
    setLogoUrl("");
    setPartner({ ...partner, logo_url: null });
  }

  async function saveDomain() {
    if (!partner) return;
    setDomainSaving(true);
    setDomainError("");

    const cleanUrl = normalizeBusinessDomain(businessUrl);

    try {
      const res = await fetch("/api/partner/add-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessUrl: cleanUrl, domainType: "subdomain" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDomainError(data.error || "Failed to register domain.");
        setDomainSaving(false);
        return;
      }
      setSavedSubdomain(data.domain);
      setDomainVerifyStatus("idle");
      setPartner({ ...partner, business_url: cleanUrl, partner_slug: partnerSlug });
      setSaveSuccess("domain");
      setTimeout(() => setSaveSuccess(""), 3000);
    } catch {
      setDomainError("Something went wrong. Please try again.");
    }
    setDomainSaving(false);
  }

  async function verifyDomain() {
    if (!savedSubdomain) return;
    setDomainVerifying(true);
    setDomainVerifyMessage("");
    try {
      const res = await fetch(`/api/partner/verify-domain?domain=${savedSubdomain}`);
      const data = await res.json();
      if (data.verified) {
        setDomainVerifyStatus("verified");
        setDomainVerifyMessage("Your domain is verified and live!");
      } else if (data.records?.length > 0) {
        setDomainVerifyStatus("wrong");
        setDomainVerifyMessage(data.message || "CNAME found but points to wrong destination.");
      } else {
        setDomainVerifyStatus("pending");
        setDomainVerifyMessage(data.message || "No CNAME found yet. DNS can take up to 48 hours.");
      }
    } catch {
      setDomainVerifyMessage("DNS check failed. Please try again.");
    }
    setDomainVerifying(false);
  }

  async function saveEmail() {
    if (!partner) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("partners")
      .update({ sender_name: senderName, sender_email: senderEmail })
      .eq("id", partner.id);
    setPartner({ ...partner, sender_name: senderName, sender_email: senderEmail });
    setSaving(false);
    setSaveSuccess("email");
    setTimeout(() => setSaveSuccess(""), 2000);
  }

  async function saveAccount() {
    if (!partner) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    }
    setPartner({
      ...partner,
      profiles: { full_name: fullName, email },
    });
    setSaving(false);
    setSaveSuccess("account");
    setTimeout(() => setSaveSuccess(""), 2000);
  }

  async function saveReviewFee() {
    if (!partner) return;
    setSaving(true);
    const supabase = createClient();
    const feeInCents = Math.round(reviewFee * 100);
    await supabase.from("partners").update({ custom_review_fee: feeInCents }).eq("id", partner.id);
    setPartner({ ...partner, custom_review_fee: feeInCents });
    setSaving(false);
    setSaveSuccess("attorney_review");
    setTimeout(() => setSaveSuccess(""), 2000);
  }

  async function saveVaultBrand() {
    if (!partner) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("partners")
      .update({
        company_name: companyName,
        product_name: productName,
        accent_color: accentColor,
        vault_tagline: vaultTagline,
        vault_theme: vaultTheme,
      })
      .eq("id", partner.id);
    setPartner({ ...partner, company_name: companyName, product_name: productName, accent_color: accentColor, vault_tagline: vaultTagline, vault_theme: vaultTheme });
    setSaving(false);
    setSaveSuccess("vault_branding");
    setTimeout(() => setSaveSuccess(""), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!partner) return null;

  const isEnterprise = partner.tier === "enterprise";
  const isBasic = partner.tier === "basic";

  const sections: Array<{
    key: SectionKey;
    title: string;
    subtitle: string;
    content: React.ReactNode;
  }> = [
    {
      key: "plan",
      title: "Plan",
      subtitle: isBasic ? "Basic Plan — $500 one-time" : isEnterprise ? "Enterprise Plan — $6,000 one-time" : "Standard Plan — $1,200 one-time",
      content: (
        <div>
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-navy">
                  {isBasic ? "Basic" : isEnterprise ? "Enterprise" : "Standard"} Plan
                </p>
                <p className="text-xs text-charcoal/50 mt-1">
                  {isBasic ? "$500 one-time · White-label vault only" : isEnterprise ? "$6,000 one-time · Unlimited documents" : "$1,200 one-time · Unlimited documents"}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isBasic ? "bg-blue-50 text-blue-600" : isEnterprise ? "bg-gold/20 text-gold" : "bg-navy/10 text-navy"}`}>
                {isBasic ? "Basic" : isEnterprise ? "Enterprise" : "Standard"}
              </span>
            </div>
          </div>
          {isBasic && (
            <p className="mt-3 text-xs text-charcoal/50">
              Want to upgrade to Standard or Enterprise? Contact partners@estatevault.com.
            </p>
          )}
          {!isEnterprise && !isBasic && (
            <p className="mt-3 text-xs text-charcoal/50">
              Want to upgrade to Enterprise? Contact your account manager or email
              partners@estatevault.com.
            </p>
          )}
        </div>
      ),
    },
    {
      key: "brand",
      title: "Brand",
      subtitle: companyName || "Configure your branding",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Product Name</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Logo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoUpload(f);
                e.target.value = "";
              }}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleLogoUpload(f);
              }}
              className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-gold bg-gold/5" : "border-gray-300 hover:border-gold/60"}`}
            >
              {uploading ? (
                <p className="text-sm text-charcoal/60">Uploading...</p>
              ) : logoUrl ? (
                <div className="flex items-center justify-center gap-4">
                  <div className="relative h-16 w-32">
                    <Image src={logoUrl} alt="Logo" fill className="object-contain" unoptimized />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="text-xs text-gold hover:text-gold/80"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeLogo(); }}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-charcoal/50">Drag and drop or click to upload</p>
                  <p className="text-xs text-charcoal/60 mt-1">PNG, SVG, JPG max 5MB</p>
                </>
              )}
            </div>
            {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Accent Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-14 rounded border-0 cursor-pointer"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={saveBrand}
              disabled={saving}
              className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : saveSuccess === "brand" ? "Saved!" : "Save Changes"}
            </button>
            <button
              onClick={cancelSection}
              className="rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-charcoal/60 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "pricing",
      title: "Pricing",
      subtitle: "Fixed by EstateVault",
      content: (
        <div>
          <p className="text-sm text-charcoal/60 mb-4">
            Pricing is set by EstateVault to keep the product premium and your earnings consistent.
            These prices cannot be changed.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                name: "Will Package",
                clientPays: "$400",
                earnings: isEnterprise ? "$350" : "$300",
              },
              {
                name: "Trust Package",
                clientPays: "$600",
                earnings: isEnterprise ? "$450" : "$400",
              },
              { name: "Attorney Review", clientPays: "$300", earnings: "$0 (goes to attorney)" },
              {
                name: "Document Amendment",
                clientPays: "$50",
                earnings: "$10",
              },
            ].map((pkg) => (
              <div key={pkg.name} className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm font-semibold text-navy">{pkg.name}</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-charcoal/50">Client pays</span>
                    <span className="font-medium text-navy">{pkg.clientPays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-charcoal/50">Your earnings</span>
                    <span className="font-medium text-green-600">{pkg.earnings}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "domain",
      title: "Domain",
      subtitle: savedSubdomain
        ? domainVerifyStatus === "verified"
          ? `✓ ${savedSubdomain}`
          : `⏳ ${savedSubdomain}`
        : "Not configured",
      content: (
        <div className="space-y-5">
          {/* Business domain input */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Business Domain</label>
            <p className="text-xs text-charcoal/50 mb-2">
              Enter your domain (e.g. <span className="font-mono">thepeoplesfirm.com</span>). Do not include www or https.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={businessUrl}
                onChange={(e) => setBusinessUrl(normalizeBusinessDomain(e.target.value))}
                placeholder="yourcompany.com"
                className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none font-mono"
              />
              <button
                onClick={saveDomain}
                disabled={domainSaving || !businessUrl}
                className="px-5 py-3 rounded-xl bg-navy text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50 transition-colors"
              >
                {domainSaving ? "Saving..." : saveSuccess === "domain" ? "Saved!" : savedSubdomain ? "Update" : "Save"}
              </button>
            </div>
            {domainError && <p className="mt-2 text-xs text-red-600">{domainError}</p>}
            {businessUrl && (
              <p className="mt-1 text-xs text-charcoal/50">
                Your site will be at:{" "}
                <span className="font-mono text-navy">legacy.{normalizeBusinessDomain(businessUrl)}</span>
              </p>
            )}
          </div>

          {/* DNS instructions */}
          {savedSubdomain && (
            <>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-navy mb-2">Required DNS Record</p>
                <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
                  <div className="text-xs font-mono">
                    <span className="text-charcoal/40">CNAME</span>{" "}
                    <span className="text-navy font-bold">legacy</span>{" "}
                    <span className="text-charcoal/40">→</span>{" "}
                    <span className="text-navy">cname.estatevault.us</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("cname.estatevault.us");
                      setCopiedDns(true);
                      setTimeout(() => setCopiedDns(false), 2000);
                    }}
                    className="text-xs text-gold hover:text-gold/80 ml-4"
                  >
                    {copiedDns ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-charcoal/40 mt-2">
                  Add this to your domain registrar DNS settings. Changes can take up to 48 hours.
                </p>
              </div>

              {/* Verification status */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-navy">DNS Status</p>
                  <p className="text-xs font-mono text-charcoal/50 mt-0.5">{savedSubdomain}</p>
                  {domainVerifyMessage && (
                    <p className={`text-xs mt-1 ${domainVerifyStatus === "verified" ? "text-green-700" : "text-charcoal/50"}`}>
                      {domainVerifyMessage}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {domainVerifyStatus === "verified" && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">✓ Live</span>
                  )}
                  {domainVerifyStatus === "pending" && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">⏳ Propagating</span>
                  )}
                  {domainVerifyStatus === "wrong" && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">✗ Wrong Target</span>
                  )}
                  {domainVerifyStatus === "idle" && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">Not checked</span>
                  )}
                  <button
                    onClick={verifyDomain}
                    disabled={domainVerifying}
                    className="px-4 py-2 rounded-lg bg-navy text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-50 transition-colors"
                  >
                    {domainVerifying ? "Checking..." : "Check DNS"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Fallback slug URL */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
            <p className="text-xs font-medium text-charcoal/60">Fallback URL (always works):</p>
            <p className="mt-1 text-sm font-mono text-navy">estatevault.us/{partnerSlug || "your-slug"}</p>
          </div>

          <button
            onClick={cancelSection}
            className="rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-charcoal/60 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      ),
    },
    {
      key: "email",
      title: "Email",
      subtitle: senderEmail || "Not configured",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Sender Name</label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
            />
            <p className="mt-1 text-xs text-charcoal/50">
              How your name appears in client inboxes
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Sender Email</label>
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="plans@yourcompany.com"
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={saveEmail}
              disabled={saving}
              className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : saveSuccess === "email" ? "Saved!" : "Save Changes"}
            </button>
            <button
              onClick={cancelSection}
              className="rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-charcoal/60 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "payouts",
      title: "Payouts",
      subtitle: partner.stripe_account_id ? "Stripe Connected" : "Not configured",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                partner.stripe_account_id
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {partner.stripe_account_id ? "Connected" : "Not Connected"}
            </span>
            <span className="text-sm text-charcoal/60">
              {partner.stripe_account_id
                ? "Your Stripe account is connected and receiving payouts."
                : "Connect your Stripe account to receive instant payouts."}
            </span>
          </div>
          <button
            onClick={handleStripeConnect}
            disabled={connectingStripe}
            className="rounded-full bg-navy px-6 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-60"
          >
            {connectingStripe ? "Connecting..." : partner.stripe_account_id ? "Manage Stripe Account" : "Connect with Stripe"}
          </button>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-medium text-navy">Payout Schedule</p>
            <ul className="mt-2 space-y-1 text-xs text-charcoal/50">
              {isBasic ? (
                <>
                  <li>Payouts are sent instantly after each successful payment.</li>
                  <li>No weekly batching for Basic plan payouts.</li>
                </>
              ) : (
                <>
                  <li>Payouts are sent instantly after each successful payment.</li>
                  <li>No weekly batching for Standard and Enterprise payouts.</li>
                </>
              )}
            </ul>
          </div>
        </div>
      ),
    },
    ...(isEnterprise
      ? [
          {
            key: "team" as SectionKey,
            title: "Team",
            subtitle: "Manage team members",
            content: (
              <div className="space-y-4">
                <p className="text-sm text-charcoal/60">
                  Invite team members to access your EstateVault Pro portal. Enterprise plans
                  include up to 10 team seats.
                </p>
                <div className="flex gap-3">
                  <input
                    type="email"
                    placeholder="team@yourcompany.com"
                    className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
                  />
                  <button className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90">
                    Invite
                  </button>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-xs text-charcoal/60">No team members added yet.</p>
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "attorney_review",
      title: "Attorney Reviews",
      subtitle:
        partner.professional_type === "attorney" && partner.has_inhouse_estate_attorney
          ? `Custom fee: $${reviewFee}`
          : "Handled by EstateVault",
      content:
        partner.professional_type === "attorney" && partner.has_inhouse_estate_attorney ? (
          <div className="space-y-4">
            <p className="text-sm text-charcoal/60">
              Your firm has an in-house estate planning attorney on staff. The attorney review fee
              is paid to your firm&apos;s Stripe Connect account. You can adjust the fee charged to
              your clients below.
            </p>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Attorney Review Fee
              </label>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-charcoal/60">$</span>
                <input
                  type="number"
                  min={100}
                  max={1000}
                  step={25}
                  value={reviewFee}
                  onChange={(e) => setReviewFee(Number(e.target.value))}
                  className="w-32 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-charcoal/50">
                Default is $300. This fee goes directly to your firm via Stripe Connect.
              </p>
            </div>
            <div className="rounded-lg bg-navy/5 p-4">
              <p className="text-xs font-medium text-navy">How it works</p>
              <ul className="mt-2 space-y-1 text-xs text-charcoal/50">
                <li>• Client adds attorney review at checkout for ${reviewFee}</li>
                <li>• Review is assigned to your in-house attorney</li>
                <li>• Full fee is transferred to your Stripe Connect account</li>
                <li>• You pay your attorney via your own payroll</li>
              </ul>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={saveReviewFee}
                disabled={saving}
                className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : saveSuccess === "attorney_review" ? "Saved!" : "Save Fee"}
              </button>
              <button
                onClick={cancelSection}
                className="rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-charcoal/60 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Included
              </span>
              <span className="text-sm text-charcoal/60">
                Attorney reviews are handled by EstateVault&apos;s in-house counsel.
              </span>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium text-navy">What clients see</p>
              <ul className="mt-2 space-y-1 text-xs text-charcoal/50">
                <li>• Optional $300 attorney review add-on at checkout</li>
                <li>• Reviews completed within 48 hours</li>
                <li>• Handled by a licensed estate planning attorney</li>
              </ul>
            </div>
            {partner.professional_type === "attorney" && !partner.has_inhouse_estate_attorney && (
              <p className="text-xs text-charcoal/60">
                If your firm has a licensed estate planning attorney who can handle reviews,
                contact info@estatevault.us to enable in-house attorney reviews.
              </p>
            )}
          </div>
        ),
    },
    ...(isBasic ? [{
      key: "vault_branding" as SectionKey,
      title: "Vault Branding",
      subtitle: productName || "Customize your white-label vault",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Vault Product Name</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
              placeholder="Acme Secure Vault"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Tagline</label>
            <input
              type="text"
              value={vaultTagline}
              onChange={(e) => setVaultTagline(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
              placeholder="Secure your legacy, protect your family."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Accent Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-14 rounded border-0 cursor-pointer"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-2">Base Theme</label>
            <div className="flex gap-3">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setVaultTheme(t)}
                  className={`flex-1 rounded-xl border-2 py-3 text-sm font-medium capitalize transition ${vaultTheme === t ? "border-gold bg-gold/5 text-navy" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                >
                  {t === "light" ? "☀️ Light" : "🌙 Dark"}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">Your Vault URL</p>
            <p className="text-sm font-mono text-navy">
              {vaultSubdomainDisplay ? `https://${vaultSubdomainDisplay}.estatevault.us` : "Not set"}
            </p>
            {vaultSubdomainDisplay && (
              <p className="text-xs text-charcoal/50 mt-1">
                Subdomain cannot be changed. Contact info@estatevault.us to request a change.
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={saveVaultBrand}
              disabled={saving}
              className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : saveSuccess === "vault_branding" ? "Saved!" : "Save Changes"}
            </button>
            <button
              onClick={cancelSection}
              className="rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-charcoal/60 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
    }] : []),
    {
      key: "account",
      title: "Account",
      subtitle: email || "Your account details",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm bg-gray-50 text-charcoal/50 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-charcoal/60">
              Contact support to change your email address.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={saveAccount}
              disabled={saving}
              className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : saveSuccess === "account" ? "Saved!" : "Save Changes"}
            </button>
            <button
              onClick={cancelSection}
              className="rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-charcoal/60 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-navy">Settings</h1>
      <p className="mt-1 text-sm text-charcoal/60">Manage your platform configuration.</p>

      {stripeConnectSuccess && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Stripe account connected successfully.
        </div>
      )}

      <div className="mt-6 space-y-3">
        {sections.map((section) => (
          <div
            key={section.key}
            className="rounded-xl bg-white border border-gray-200 overflow-hidden"
          >
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-semibold text-navy">{section.title}</p>
                <p className="text-xs text-charcoal/50 mt-0.5">{section.subtitle}</p>
              </div>
              <span
                className={`text-charcoal/30 transition-transform ${
                  openSection === section.key ? "rotate-180" : ""
                }`}
              >
                &#9660;
              </span>
            </button>
            {openSection === section.key && (
              <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
