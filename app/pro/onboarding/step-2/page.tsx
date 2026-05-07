"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { THEME_PRESETS, HERO_RECIPES, buildPartnerTheme, buildHeroRecipe, contrastRatio, type ThemePresetId, type HeroRecipeId } from "@/lib/partner-pages/theme";

export default function Step2Page() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("Legacy Protection");
  const [accentColor, setAccentColor] = useState("#C9A84C");
  const [themePreset, setThemePreset] = useState<ThemePresetId>("cool");
  const [heroRecipe, setHeroRecipe] = useState<HeroRecipeId>("mesh");
  const [customizeColors, setCustomizeColors] = useState(false);
  const [highlightDark, setHighlightDark] = useState<string>("");
  const [highlightLight, setHighlightLight] = useState<string>("");
  const [ctaTextOverride, setCtaTextOverride] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [textColorOverride, setTextColorOverride] = useState("");
  const [landingTextColor, setLandingTextColor] = useState("#1C3557");
  const [customGradient, setCustomGradient] = useState(false);
  const [gradFrom, setGradFrom] = useState("#1C3557");
  const [gradTo, setGradTo] = useState("#C9A84C");
  const [gradAngle, setGradAngle] = useState(180);
  const previewTheme = useMemo(() => buildPartnerTheme(accentColor, themePreset), [accentColor, themePreset]);
  const baseHero = useMemo(
    () => buildHeroRecipe(accentColor, heroRecipe, {
      highlightDark: highlightDark || null,
      ctaText: ctaTextOverride || null,
    }),
    [accentColor, heroRecipe, highlightDark, ctaTextOverride]
  );
  const previewHero = useMemo(() => {
    const h = { ...baseHero };
    if (customGradient) {
      h.background = `linear-gradient(${gradAngle}deg, ${gradFrom} 0%, ${gradTo} 100%)`;
      h.overlay = undefined;
    }
    if (textColorOverride) {
      h.heroText = textColorOverride;
      h.heroHighlight = textColorOverride;
    }
    return h;
  }, [baseHero, customGradient, gradFrom, gradTo, gradAngle, textColorOverride]);
  const effectiveLightHL = highlightLight || previewTheme.palette["800"];

  const previewMock = (
    <div className="mx-auto max-w-sm rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
      <div className="bg-gray-100 px-3 py-2 flex items-center gap-1.5 border-b border-gray-200">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="ml-3 flex-1 rounded bg-white px-2 py-0.5 text-[10px] text-charcoal/50 truncate">legacy.{(companyName || "yourbrand").toLowerCase().replace(/\s+/g, "")}.com</div>
      </div>
      <div className="bg-white px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: `${accentColor}33` }}>
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <div className="relative h-6 w-6"><Image src={logoUrl} alt="Logo" fill className="object-contain rounded" unoptimized /></div>
          ) : (
            <div className="h-6 w-6 rounded" style={{ background: accentColor }} />
          )}
          <span className="text-xs font-bold" style={{ color: landingTextColor }}>{companyName || "Your Brand"}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-charcoal/60">Wills</span>
          <span className="text-[10px] text-charcoal/60">Trusts</span>
          <span className="text-[10px] text-charcoal/60">Pricing</span>
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: accentColor, color: previewHero.ctaText }}>Sign In</span>
        </div>
      </div>
      <div className="relative overflow-hidden px-5 py-10 text-center" style={{ background: previewHero.background, color: previewHero.heroText }}>
        {previewHero.overlay && <div className="absolute inset-0 pointer-events-none" style={{ background: previewHero.overlay }} />}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mb-3 border" style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.14)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] font-medium tracking-wide uppercase" style={{ color: previewHero.heroSubtext }}>{productName}, Trusted by Families</span>
          </div>
          <p className="text-xl font-bold leading-tight tracking-tight">Protect Your Family.</p>
          <p className="text-xl font-bold leading-tight tracking-tight" style={{ color: previewHero.heroHighlight }}>Peace of Mind in Minutes.</p>
          <p className="mt-2 text-[11px] max-w-xs mx-auto leading-relaxed" style={{ color: previewHero.heroSubtext }}>Attorney-reviewed wills and trusts built for modern families.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="rounded-full px-4 py-1.5 text-[10px] font-semibold shadow-lg" style={{ background: accentColor, color: previewHero.ctaText }}>Begin Your Will</span>
            <span className="rounded-full px-4 py-1.5 text-[10px] font-semibold border" style={{ borderColor: previewHero.heroText, color: previewHero.heroText }}>Learn More</span>
          </div>
        </div>
      </div>
      <div className="px-5 py-6" style={{ background: previewTheme.sectionAlt }}>
        <p className="text-center text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: effectiveLightHL }}>How It Works</p>
        <p className="text-center text-sm font-bold mb-4" style={{ color: landingTextColor }}>Estate planning made simple</p>
        <div className="grid grid-cols-3 gap-2">
          {["Answer", "Review", "Sign"].map((t, i) => (
            <div key={t} className="rounded-lg bg-white p-3 text-center border border-gray-100">
              <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: previewTheme.palette["100"], color: effectiveLightHL }}>{i + 1}</div>
              <p className="text-[10px] font-semibold" style={{ color: landingTextColor }}>{t}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="px-5 py-6 bg-white">
        <p className="text-center text-sm font-bold mb-3" style={{ color: landingTextColor }}>Simple Pricing</p>
        <div className="rounded-xl border-2 p-4 text-center" style={{ borderColor: accentColor }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: effectiveLightHL }}>Will Package</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: landingTextColor }}>$400</p>
          <p className="mt-0.5 text-[10px] text-charcoal/60">Attorney-reviewed · State-specific</p>
          <span className="mt-3 inline-block rounded-full px-4 py-1.5 text-[10px] font-semibold" style={{ background: accentColor, color: previewHero.ctaText }}>Get Started</span>
        </div>
      </div>
      <div className="px-5 py-4 text-center border-t" style={{ background: previewTheme.heroBg, borderColor: `${accentColor}33` }}>
        <p className="text-[10px] font-semibold" style={{ color: previewTheme.heroText }}>{companyName || "Your Brand"}</p>
        <p className="mt-0.5 text-[9px]" style={{ color: previewTheme.heroSubtext }}>Powered by EstateVault</p>
      </div>
    </div>
  );

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase.from("partners").select("id, company_name, product_name, accent_color, theme_preset, hero_recipe, highlight_dark, highlight_light, cta_text_override, landing_text_color, logo_url").eq("profile_id", user.id).single();
      if (partner) {
        setPartnerId(partner.id);
        setCompanyName(partner.company_name || "");
        if (partner.product_name) setProductName(partner.product_name);
        if (partner.accent_color) setAccentColor(partner.accent_color);
        if (partner.theme_preset) setThemePreset(partner.theme_preset as ThemePresetId);
        if (partner.hero_recipe) setHeroRecipe(partner.hero_recipe as HeroRecipeId);
        if (partner.highlight_dark) setHighlightDark(partner.highlight_dark);
        if (partner.highlight_light) setHighlightLight(partner.highlight_light);
        if (partner.cta_text_override) setCtaTextOverride(partner.cta_text_override);
        if (partner.landing_text_color) setLandingTextColor(partner.landing_text_color);
        if (partner.logo_url) setLogoUrl(partner.logo_url);
      }
    }
    load();
  }, []);

  async function handleLogoUpload(file: File) {
    if (!file) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Please upload a PNG, JPG, SVG, or WebP file.");
      return;
    }

    // Validate file size (5MB)
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

      const { error: uploadErr } = await supabase.storage
        .from("logos")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) {
        // If bucket doesn't exist, try the documents bucket as fallback
        const { error: fallbackErr } = await supabase.storage
          .from("documents")
          .upload(filePath, file, { upsert: true });

        if (fallbackErr) {
          setUploadError("Upload failed. Please try again.");
          setUploading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(filePath);

        setLogoUrl(urlData.publicUrl);
        await supabase.from("partners").update({ logo_url: urlData.publicUrl }).eq("id", partnerId);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(filePath);

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
    if (!companyName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("partners").update({
      company_name: companyName,
      product_name: productName,
      accent_color: accentColor,
      theme_preset: themePreset,
      hero_recipe: heroRecipe,
      highlight_dark: customizeColors && highlightDark ? highlightDark : null,
      highlight_light: customizeColors && highlightLight ? highlightLight : null,
      cta_text_override: customizeColors && ctaTextOverride ? ctaTextOverride : null,
      landing_text_color: landingTextColor,
      logo_url: logoUrl || null,
      onboarding_step: 3,
    }).eq("id", partnerId);
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
            <input type="text" value={productName} readOnly disabled className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm text-charcoal/60 cursor-not-allowed" />
            <p className="mt-1 text-xs text-charcoal/50">Appears in your URL, emails, and documents</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Logo Upload</label>
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
              className="rounded-xl border-2 border-dashed border-gray-300 p-6 text-center cursor-pointer hover:border-gold/50 transition-colors"
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-charcoal/60">Uploading...</p>
                </div>
              ) : logoUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative h-32 w-32">
                    <Image src={logoUrl} alt="Logo" fill className="object-contain rounded" unoptimized />
                  </div>
                  <p className="text-xs text-charcoal/50">Click to replace</p>
                </div>
              ) : (
                <>
                  <div className="mx-auto w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <p className="text-sm text-charcoal/60">Drag and drop or click to upload</p>
                  <p className="text-xs text-charcoal/60 mt-1">PNG, SVG, JPG, WebP, max 5MB</p>
                </>
              )}
            </div>
            {uploadError && (
              <p className="mt-2 text-xs text-red-600">{uploadError}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Accent Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-14 rounded border-0 cursor-pointer" />
              <input type="text" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Landing Text & Icon Color</label>
            <p className="text-xs text-charcoal/60 mb-2">Headings, body labels, and icon strokes on your landing page.</p>
            <div className="flex items-center gap-3">
              <input type="color" value={landingTextColor} onChange={(e) => setLandingTextColor(e.target.value)} className="h-10 w-14 rounded border-0 cursor-pointer" />
              <input type="text" value={landingTextColor} onChange={(e) => setLandingTextColor(e.target.value)} className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              <button type="button" onClick={() => setLandingTextColor("#1C3557")} className="text-xs text-charcoal/60 underline">Reset</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-2">Hero Background</label>
            <p className="text-xs text-charcoal/60 mb-3">4 styles, auto-tinted to your accent. Pick one.</p>
            <div className="grid grid-cols-2 gap-3">
              {HERO_RECIPES.map((id) => {
                const r = buildHeroRecipe(accentColor, id);
                const selected = heroRecipe === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setHeroRecipe(id)}
                    className={`relative rounded-xl overflow-hidden border-2 text-left transition-all ${selected ? "border-navy shadow-md" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="h-24 relative" style={{ background: r.background }}>
                      {r.overlay && <div className="absolute inset-0" style={{ background: r.overlay }} />}
                      <div className="relative z-10 p-3">
                        <p className="text-xs font-bold leading-tight" style={{ color: r.heroText }}>Protect Your Family.</p>
                        <p className="text-xs font-bold leading-tight" style={{ color: r.heroHighlight }}>Peace of Mind.</p>
                      </div>
                    </div>
                    <div className="px-3 py-2 bg-white flex items-center justify-between">
                      <span className="text-xs font-semibold text-navy capitalize">{r.label}</span>
                      {selected && <span className="text-[10px] font-semibold text-gold">SELECTED</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Primary Text Color</label>
            <p className="text-xs text-charcoal/60 mb-2">Override hero headline color. Leave blank for auto contrast.</p>
            <div className="flex items-center gap-3">
              <input type="color" value={textColorOverride || "#FFFFFF"} onChange={(e) => setTextColorOverride(e.target.value)} className="h-10 w-14 rounded border-0 cursor-pointer" />
              <input type="text" value={textColorOverride} placeholder="auto" onChange={(e) => setTextColorOverride(e.target.value)} className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              {textColorOverride && (
                <button type="button" onClick={() => setTextColorOverride("")} className="text-xs text-charcoal/60 underline">Reset</button>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-navy">Custom Background Gradient</label>
              <button type="button" onClick={() => setCustomGradient((v) => !v)} className={`text-xs px-3 py-1 rounded-full font-semibold ${customGradient ? "bg-navy text-white" : "bg-gray-100 text-charcoal/70"}`}>{customGradient ? "On" : "Off"}</button>
            </div>
            <p className="text-xs text-charcoal/60 mb-2">Override the hero recipe with a 2-stop gradient.</p>
            {customGradient && (
              <div className="space-y-3 rounded-xl border-2 border-gray-200 p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs w-12 text-charcoal/60">From</span>
                  <input type="color" value={gradFrom} onChange={(e) => setGradFrom(e.target.value)} className="h-9 w-12 rounded border-0 cursor-pointer" />
                  <input type="text" value={gradFrom} onChange={(e) => setGradFrom(e.target.value)} className="flex-1 min-h-[36px] rounded-lg border border-gray-200 px-3 text-sm" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-12 text-charcoal/60">To</span>
                  <input type="color" value={gradTo} onChange={(e) => setGradTo(e.target.value)} className="h-9 w-12 rounded border-0 cursor-pointer" />
                  <input type="text" value={gradTo} onChange={(e) => setGradTo(e.target.value)} className="flex-1 min-h-[36px] rounded-lg border border-gray-200 px-3 text-sm" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-12 text-charcoal/60">Angle</span>
                  <input type="range" min={0} max={360} value={gradAngle} onChange={(e) => setGradAngle(Number(e.target.value))} className="flex-1" />
                  <span className="text-xs w-10 text-right text-charcoal/70">{gradAngle}°</span>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-2">Theme</label>
            <p className="text-xs text-charcoal/60 mb-3">Tints derive from your accent. Pick the mood.</p>
            <div className="grid grid-cols-5 gap-2">
              {THEME_PRESETS.map((p) => {
                const t = buildPartnerTheme(accentColor, p.id);
                const selected = themePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setThemePreset(p.id)}
                    className={`group relative rounded-xl overflow-hidden border-2 transition-all ${selected ? "border-navy" : "border-gray-200 hover:border-gray-300"}`}
                    title={p.description}
                  >
                    <div className="h-12" style={{ background: `linear-gradient(180deg, ${t.heroBg}, ${t.heroBgEnd})` }} />
                    <div className="flex items-center justify-between px-2 py-1.5 bg-white">
                      <span className="text-[11px] font-semibold text-navy">{p.label}</span>
                      <span className="h-3 w-3 rounded-full" style={{ background: accentColor }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-navy">Customize Colors</p>
                <p className="text-xs text-charcoal/60">Auto-tuned by default. Override if you want exact control.</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizeColors(!customizeColors)}
                className={`relative shrink-0 h-6 w-11 rounded-full transition-colors ${customizeColors ? "bg-gold" : "bg-gray-300"}`}
              >
                <span
                  className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: customizeColors ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {customizeColors && (
              <div className="mt-4 space-y-4">
                {[
                  { label: "Highlight on dark sections", help: "Hero h1 highlight, vault icons, dark CTA. Auto: pale tint of accent.", val: highlightDark, set: setHighlightDark, fallback: baseHero.heroHighlight, bg: baseHero.background as string, isOverlay: !!baseHero.overlay, overlay: baseHero.overlay },
                  { label: "Highlight on light sections", help: "Step badges, pricing pill, check icons, stars on white bg. Auto: dark accent shade.", val: highlightLight, set: setHighlightLight, fallback: previewTheme.palette["800"], bg: "#FFFFFF", isOverlay: false, overlay: undefined as string | undefined },
                  { label: "CTA button text", help: "Text on accent-colored buttons. Auto: contrast-checked white or navy.", val: ctaTextOverride, set: setCtaTextOverride, fallback: baseHero.ctaText, bg: accentColor, isOverlay: false, overlay: undefined as string | undefined },
                ].map((row) => {
                  const effective = row.val || row.fallback;
                  // Compute contrast against a representative bg color (base[900] for dark, white for light, accent for cta).
                  const contrastBg = row.label.startsWith("Highlight on dark") ? previewTheme.palette["900"] : row.label.startsWith("Highlight on light") ? "#FFFFFF" : accentColor;
                  const cr = contrastRatio(effective, contrastBg);
                  const pass = cr >= 4.5;
                  return (
                    <div key={row.label}>
                      <label className="block text-xs font-medium text-navy mb-1">{row.label}</label>
                      <p className="text-[11px] text-charcoal/55 mb-2">{row.help}</p>
                      <div className="flex items-center gap-2">
                        <input type="color" value={effective} onChange={(e) => row.set(e.target.value)} className="h-9 w-12 rounded border-0 cursor-pointer" />
                        <input type="text" value={row.val} placeholder={row.fallback} onChange={(e) => row.set(e.target.value)} className="flex-1 min-h-[38px] rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-gold focus:outline-none" />
                        {row.val && (
                          <button type="button" onClick={() => row.set("")} className="text-[11px] text-charcoal/60 hover:text-navy underline">Reset</button>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="relative flex-1 h-9 rounded-md overflow-hidden border border-gray-200" style={{ background: row.bg }}>
                          {row.isOverlay && row.overlay && <div className="absolute inset-0" style={{ background: row.overlay }} />}
                          <div className="relative z-10 h-full flex items-center justify-center text-xs font-semibold" style={{ color: effective }}>
                            Sample Highlight Text
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded ${pass ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          {pass ? `✓ ${cr.toFixed(1)}:1` : `✗ ${cr.toFixed(1)}:1`}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-charcoal/55">Aim for ≥ 4.5:1 contrast (WCAG AA). Below that, text may be hard to read.</p>
              </div>
            )}
          </div>
        </div>

        {/* Live preview — right column. Aligns to bottom when customize ON so it sits next to picker panel. */}
        <div className={`flex flex-col ${customizeColors ? "justify-end" : ""}`}>
          <p className="text-sm font-semibold text-navy mb-3">Live Preview</p>
          {previewMock}
        </div>
      </div>

      <button onClick={handleContinue} disabled={!companyName.trim() || saving} className="mt-8 w-full min-h-[44px] rounded-full bg-gold py-3.5 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
        {saving ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}
