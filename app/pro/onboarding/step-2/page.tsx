"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Step2Page() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("Legacy Protection");
  const [accentColor, setAccentColor] = useState("#C9A84C");
  const [saving, setSaving] = useState(false);
  const [partnerId, setPartnerId] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase.from("partners").select("id, company_name, product_name, accent_color").eq("profile_id", user.id).single();
      if (partner) {
        setPartnerId(partner.id);
        setCompanyName(partner.company_name || "");
        if (partner.product_name) setProductName(partner.product_name);
        if (partner.accent_color) setAccentColor(partner.accent_color);
      }
    }
    load();
  }, []);

  async function handleContinue() {
    if (!companyName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("partners").update({ company_name: companyName, product_name: productName, accent_color: accentColor, onboarding_step: 3 }).eq("id", partnerId);
    router.push("/pro/onboarding/step-3");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Brand Your Platform</h1>
      <p className="mt-1 text-sm text-charcoal/60">This is what your clients will see.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Company Name</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            <p className="mt-1 text-xs text-charcoal/50">Your business name as clients will see it</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Product Name</label>
            <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            <p className="mt-1 text-xs text-charcoal/50">Appears in your URL, emails, and documents</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Logo Upload</label>
            <div className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-charcoal/50">Drag and drop or click to upload</p>
              <p className="text-xs text-charcoal/40 mt-1">PNG, SVG, JPG — max 5MB</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Accent Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-14 rounded border-0 cursor-pointer" />
              <input type="text" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p className="text-sm font-semibold text-navy mb-3">Live Preview</p>
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-white px-4 py-3 flex items-center gap-3" style={{ borderBottom: `2px solid ${accentColor}` }}>
                <div className="h-8 w-8 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500">Logo</div>
                <span className="text-sm font-bold text-navy">{productName || "Legacy Protection"}</span>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-xs text-charcoal/50">Email Preview</div>
              <div className="p-4">
                <p className="text-sm font-semibold text-navy">{companyName || "Company"}</p>
                <p className="text-xs text-charcoal/50">Your Last Will & Testament is ready to review</p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div style={{ height: 3, background: accentColor }} />
              <div className="p-4">
                <p className="text-xs text-charcoal/50">Prepared by <span className="font-medium text-navy">{companyName}</span> | {productName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button onClick={handleContinue} disabled={!companyName.trim() || saving} className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
        {saving ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}
