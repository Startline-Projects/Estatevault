"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { substituteTokens, type PartnerData } from "@/lib/marketing/substitute";

const TABS = ["All", "Scripts", "Email", "Social Media", "Print Materials", "Presentations"];

const SCRIPT_CONTENT = `APPROVED INTRODUCTION SCRIPT

USE THIS WORD FOR WORD:

"[Client name], one thing I want to make sure we cover today is your estate plan. A lot of my clients have been using a platform called [Product Name] to get their wills and trusts done quickly and affordably. It generates attorney-reviewed documents, takes about 15 minutes. Would you like me to walk you through it?"

IF THEY ASK "Are you my lawyer?":

"No, I'm not acting as your attorney, and this platform doesn't provide legal advice. What it does is generate attorney-reviewed estate planning documents based on your answers. If you have complex legal questions, we can connect you with a licensed estate planning attorney."

IF THEY ASK "Is this legitimate?":

"Yes, all documents are based on attorney-approved templates specific to [State]. They're the same documents an estate planning attorney would prepare, at a fraction of the cost."

NEVER SAY:
✗ "I recommend you get a trust"
✗ "You should do this"
✗ "As your advisor I think you need..."
✗ "This is legal advice"
✗ "I'm helping you with your legal plan"`;

const EMAIL_TEMPLATES = [
  { name: "Client Introduction", useCase: "Send to your client list to introduce your estate planning service", subject: "Protect your family, estate planning made simple", body: `Hi [First Name],

I wanted to share something I've been offering clients that has gotten a great response.

[Product Name] makes it simple to create a professional estate plan, a will or revocable trust, in about 15 minutes, from the comfort of your home.

Documents are based on attorney-approved templates and include everything your family needs:
- Last Will & Testament
- Power of Attorney
- Healthcare Directive
- Family Vault (secure storage for all your important documents and accounts)

Will Package: $400
Trust Package: $600

Get started at [white-label URL]

If you have any questions, reply to this email or give me a call.

Best,
[Partner Name]
[Company Name]
[Phone]` },
  { name: "7-Day Follow-Up", useCase: "Send to clients who haven't responded", subject: "Quick follow-up, your estate plan", body: `Hi [First Name],

I wanted to follow up on my note from last week about estate planning.

Many of my clients have been surprised by how quick and affordable this has become. Most finish in under 15 minutes.

[Product Name] generates attorney-reviewed documents for $400 (will) or $600 (trust), a fraction of traditional attorney costs.

Your family's protection shouldn't wait.

Get started at [white-label URL]

Best,
[Partner Name]` },
  { name: "Annual Review Reminder", useCase: "Send to existing clients 12 months after their estate plan", subject: "Time to review your estate plan", body: `Hi [First Name],

It's been about a year since you created your estate plan through [Product Name].

A lot can change in a year, new assets, family changes, address changes. We recommend a quick annual review to make sure your plan is still current.

Document amendments are available for $50.

If you have questions, I'm here to help.

Best,
[Partner Name]` },
];

const SOCIAL_POSTS = {
  linkedin: [
    { title: "Trust Awareness", caption: `Did you know 70% of Americans don't have a will?

If something happened to you tomorrow, your family would face months of court proceedings and thousands in legal fees.

Through [Company Name], your clients can create attorney-reviewed estate planning documents in 15 minutes for $400-$600.

I've been helping families protect what matters most. Ask me how.

#EstatePlanning #FinancialPlanning #ProtectYourFamily`, imageText: "70% of Americans\nhave no will.\nProtect your family.", size: "1200x627" },
    { title: "Vault Feature", caption: `Most people think estate planning is just about documents.

But what happens when a loved one passes and no one can find the insurance policy? Or the bank account information?

[Product Name] includes a secure Family Vault where clients store everything their family will need, documents, accounts, policies, digital credentials.

Everything in one secure place.

#EstatePlanning #FamilyProtection #DigitalLegacy`, imageText: "More than documents.\nA complete Family Vault.", size: "1200x627" },
    { title: "Social Proof", caption: `A client told me last week: 'I kept putting this off for years. I didn't realize it would take 15 minutes.'

That's the reaction I get consistently with [Product Name].

Attorney-reviewed wills and trusts. State-specific. Simple process.

If your clients have been putting off estate planning, let's talk.

#EstatePlanning #ClientFirst #FinancialAdvisor`, imageText: "15 minutes.\nAttorney-reviewed.\nDone.", size: "1200x627" },
  ],
  facebook: [
    { title: "Introduction", caption: `Protecting your family doesn't have to be complicated or expensive. 💙

Through [Company Name], you can create a complete estate plan, will or trust, in about 15 minutes. Attorney-reviewed documents, specific to [State].

Will Package: $400
Trust Package: $600

Have questions? Send me a message.

[white-label URL]`, imageText: "Protect Your Family\nin 15 Minutes", size: "1200x630" },
    { title: "Question Hook", caption: `Quick question for my [City] friends:

Do you have a will? Most people don't, and it means the state decides what happens to your assets and who raises your children.

I've been helping families solve this quickly and affordably. Message me to learn more. 💛`, imageText: "Do you have a will?\nMost people don't.", size: "1200x630" },
    { title: "Simple CTA", caption: `The most important financial document your family needs isn't an investment account.

It's a will or trust.

I help families in [City] create complete estate plans through [Product Name], attorney-reviewed, affordable, and done in 15 minutes.

[white-label URL]`, imageText: "Will: $400\nTrust: $600\nPeace of mind: Priceless", size: "1200x630" },
  ],
  instagram: [
    { title: "Shield", caption: `Estate planning used to mean expensive attorney appointments and months of waiting.

Not anymore. Link in bio. 🏛✨

#EstatePlanning #ProtectYourFamily #FinancialPlanning #FamilyFirst`, imageText: "Protect Your Family.\n15 Minutes. $400.", size: "1080x1080" },
    { title: "Vault", caption: `Your family shouldn't have to search for your important documents when they need them most.

Attorney-reviewed estate planning + a secure family vault for all your documents, accounts, and passwords.

Everything in one place. Link in bio.

#EstatePlanning #FamilyVault #DigitalLegacy`, imageText: "Estate Documents\nFinancial Accounts\nDigital Passwords\nAll in one vault.", size: "1080x1080" },
    { title: "Price", caption: `Attorney-reviewed estate planning documents, specific to [State].

Created in 15 minutes. Protecting families in [City].

Link in bio to get started. 💛

#EstatePlanning #ProtectYourFamily`, imageText: "Will: $400\nTrust: $600\nPeace of mind:\nPriceless", size: "1080x1080" },
  ],
};

export default function MarketingPage() {
  const [tab, setTab] = useState("All");
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [certified, setCertified] = useState(false);
  const [expandScript, setExpandScript] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<number | null>(null);
  const [copied, setCopied] = useState("");
  const [materials, setMaterials] = useState<{ id: string; title: string; description: string | null; category: string; platform?: string | null; url: string; isGlobal?: boolean }[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const imageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("partners").select("company_name, product_name, business_url, accent_color, logo_url, certification_completed").eq("profile_id", user.id).single();
      const { data: prof } = await supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).single();
      if (p && prof) {
        setPartner({ companyName: p.company_name, productName: p.product_name || "Legacy Protection", partnerName: prof.full_name || "", phone: prof.phone || "", email: prof.email, city: "", state: "Michigan", businessUrl: p.business_url || "", logoUrl: p.logo_url || "", accentColor: p.accent_color || "#C9A84C" });
        setCertified(p.certification_completed || false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadMaterials() {
      setMaterialsLoading(true);
      try {
        const res = await fetch("/api/marketing/materials");
        if (!res.ok) return;
        const json = await res.json();
        setMaterials(json.materials || []);
      } catch {} finally {
        setMaterialsLoading(false);
      }
    }
    loadMaterials();
  }, []);

  function sub(text: string) { return partner ? substituteTokens(text, partner) : text; }
  function copyText(text: string, id: string) { navigator.clipboard.writeText(sub(text)); setCopied(id); setTimeout(() => setCopied(""), 2000); }
  function isLocked() { return !certified; }

  async function downloadImage(refKey: string, filename: string) {
    const el = imageRefs.current[refKey];
    if (!el) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch {
      alert("Image download requires html-to-image. Install it with: npm install html-to-image");
    }
  }

  function LockButton({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
    if (isLocked()) return <button disabled className={`opacity-50 cursor-not-allowed ${className}`} title="Complete certification to unlock marketing materials">🔒 {children}</button>;
    return <button onClick={onClick} className={className}>{children}</button>;
  }

  const isNorthwood = !!partner?.businessUrl?.toLowerCase().includes("northwoodwealthadvisors");
  const accent = partner?.accentColor || "#C9A84C";
  const accentDark = (() => {
    const hex = accent.replace("#", "");
    if (hex.length !== 6) return accent;
    const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 30);
    const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 30);
    const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 30);
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  })();
  const heroGradient = `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`;
  const showScripts = tab === "All" || tab === "Scripts";
  const showEmail = tab === "All" || tab === "Email";
  const showSocial = tab === "All" || tab === "Social Media";
  const showPrint = tab === "All" || tab === "Print Materials";
  const showPres = tab === "All" || tab === "Presentations";

  return (
    <div className="max-w-6xl">
      <style>{`
        .mkt-themed .bg-gold { background-color: ${accent} !important; }
        .mkt-themed .text-gold { color: ${accent} !important; }
        .mkt-themed .border-gold { border-color: ${accent} !important; }
        .mkt-themed .hover\\:bg-gold\\/90:hover { background-color: ${accentDark} !important; }
        .mkt-themed .bg-gold\\/15 { background-color: ${accent}26 !important; }
        .mkt-themed .bg-gold\\/5 { background-color: ${accent}0D !important; }
        .mkt-themed .hover\\:text-gold\\/80:hover { color: ${accentDark} !important; }
      `}</style>
      <div className="mkt-themed">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl p-8 md:p-10 text-white" style={{ background: heroGradient }}>
        <div className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-black/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            {partner?.logoUrl && (
              <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25 flex items-center justify-center overflow-hidden">
                <img src={partner.logoUrl} alt={partner.companyName} className="h-10 w-10 object-contain" />
              </div>
            )}
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">
                Marketing Hub
              </span>
              <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Grow your practice.</h1>
              <p className="mt-2 max-w-xl text-sm md:text-base text-white/85 leading-relaxed">
                Pre-branded scripts, emails, social posts, and print materials. Built for {partner?.companyName || "your firm"}. Download and use immediately.
              </p>
            </div>
          </div>
          <div className="flex gap-3 md:flex-col md:items-end">
            <div className="rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 px-4 py-3 text-center">
              <p className="text-2xl font-bold">{materials.length + EMAIL_TEMPLATES.length + Object.values(SOCIAL_POSTS).flat().length + 4}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/75 mt-0.5">Assets</p>
            </div>
          </div>
        </div>
      </div>

      {!certified && (
        <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
          <p className="text-sm text-amber-800">⚠ Complete your certification training to unlock all marketing materials. The Compliance Script Card is available now.</p>
          <Link href="/pro/training" className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 shrink-0 ml-4">Complete Certification →</Link>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 sticky top-0 z-10 -mx-2 px-2 py-2 bg-white/80 backdrop-blur-md rounded-2xl">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((t) => {
            const selected = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all"
                style={selected
                  ? { background: accent, color: "#fff", boxShadow: `0 4px 14px -4px ${accent}80` }
                  : { background: "#f3f4f6", color: "#6b7280" }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "#e5e7eb"; }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "#f3f4f6"; }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* SCRIPTS */}
      {showScripts && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-navy">Compliance Script Card</h2>
          <div
            className="mt-3 relative overflow-hidden rounded-2xl p-7 text-white"
            style={{ background: heroGradient, boxShadow: `0 12px 32px -12px ${accent}66` }}
          >
            <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-black/10 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "18px 18px" }} />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] bg-white" style={{ color: accent }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: accent }} />
                  Start Here
                </span>
                <span className="text-xs text-white/75">Always available · No certification required</span>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M9 13h6M9 17h4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold tracking-tight text-white">Compliance Script Card</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/80">
                    Word-for-word approved scripts for introducing estate planning. What to say. What NOT to say. Print and keep at your desk.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/70">
                    <span className="inline-flex items-center gap-1.5">✓ Compliance-reviewed</span>
                    <span className="inline-flex items-center gap-1.5">✓ Print-ready PDF</span>
                    <span className="inline-flex items-center gap-1.5">✓ Updated 2026</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setExpandScript(!expandScript)}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-white/90 hover:text-white transition-colors"
              >
                {expandScript ? "Hide Preview" : "Show Preview"}
                <span className={`inline-block transition-transform ${expandScript ? "rotate-180" : ""}`}>▾</span>
              </button>
              {expandScript && (
                <pre className="mt-4 whitespace-pre-wrap text-sm bg-white text-charcoal/80 rounded-lg p-4 border border-gray-200 leading-relaxed">{sub(SCRIPT_CONTENT)}</pre>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={`/api/marketing/script-card`}
                  className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)]"
                  style={{ color: accent }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL TEMPLATES */}
      {showEmail && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-navy">Email Templates</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {EMAIL_TEMPLATES.map((tmpl, i) => (
              <div key={i} className="rounded-xl bg-white border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-navy">{tmpl.name}</h3>
                <p className="mt-1 text-xs text-charcoal/50">{tmpl.useCase}</p>
                <div className="mt-4 flex gap-2">
                  <LockButton onClick={() => setPreviewEmail(i)} className="rounded-full border border-navy px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy hover:text-white transition-colors">Preview</LockButton>
                  <LockButton onClick={() => copyText(tmpl.body, `email-${i}`)} className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-gold/90">
                    {copied === `email-${i}` ? "Copied!" : "Copy Email"}
                  </LockButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SOCIAL MEDIA */}
      <div className={showSocial ? "" : "hidden"}>
      {true && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-navy">Social Media Posts</h2>
          {(() => {
            const otherSocial = materials.filter((m) => m.category === "social" && (m.platform === "other" || (!m.platform && !["linkedin", "facebook", "instagram"].some((p) => m.title.toLowerCase().includes(p)))));
            if (otherSocial.length === 0) return null;
            return (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-navy">Other</h3>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {otherSocial.map((m) => (
                    <div key={m.id} className="group rounded-xl bg-white border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                      <button type="button" onClick={() => window.open(m.url, "_blank")} className="block w-full bg-gray-50 relative overflow-hidden" style={{ aspectRatio: "1/1", maxHeight: 220 }}>
                        <iframe src={`${m.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} className="absolute inset-0 w-full h-full pointer-events-none" title={m.title} />
                      </button>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold text-navy">{m.title}</h4>
                          {m.isGlobal && <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold shrink-0">Global</span>}
                        </div>
                        {m.description && <p className="mt-1 text-xs text-charcoal/50 line-clamp-2">{m.description}</p>}
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => window.open(m.url, "_blank")} className="flex-1 rounded-full border border-gray-200 px-2 py-1 text-xs font-medium text-charcoal/70 hover:bg-gray-50">Preview</button>
                          <a href={m.url} download className="flex-1 rounded-full bg-gold px-2 py-1 text-center text-xs font-semibold text-white hover:bg-gold/90">Download</a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {(["linkedin", "facebook", "instagram"] as const).map((platform) => {
            const platformPdfs = materials.filter((m) => m.category === "social" && (m.platform === platform || (!m.platform && m.title.toLowerCase().includes(platform))));
            return (
            <div key={platform} className="mt-4">
              <h3 className="text-sm font-semibold text-navy capitalize">{platform}</h3>
              {materialsLoading && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                      <div className="aspect-square bg-gray-100 animate-pulse" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 w-2/3 bg-gray-100 rounded animate-pulse" />
                        <div className="h-2 w-full bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!materialsLoading && platformPdfs.length > 0 && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {platformPdfs.map((m) => (
                    <div key={m.id} className="group rounded-xl bg-white border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                      <button
                        type="button"
                        onClick={() => window.open(m.url, "_blank")}
                        className="block w-full bg-gray-50 relative overflow-hidden"
                        style={{ aspectRatio: "1/1", maxHeight: 220 }}
                        title="Open preview"
                      >
                        <iframe
                          src={`${m.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                          className="absolute inset-0 w-full h-full pointer-events-none"
                          title={m.title}
                        />
                      </button>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold text-navy">{m.title}</h4>
                          {m.isGlobal && <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold shrink-0">Global</span>}
                        </div>
                        {m.description && <p className="mt-1 text-xs text-charcoal/50 line-clamp-2">{m.description}</p>}
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => window.open(m.url, "_blank")} className="flex-1 rounded-full border border-gray-200 px-2 py-1 text-xs font-medium text-charcoal/70 hover:bg-gray-50">
                            Preview
                          </button>
                          <a href={m.url} download className="flex-1 rounded-full bg-gold px-2 py-1 text-center text-xs font-semibold text-white hover:bg-gold/90">
                            Download
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                {SOCIAL_POSTS[platform].map((post, i) => {
                  const refKey = `${platform}-${i}`;
                  const [w, h] = post.size.split("x").map(Number);
                  const aspect = h / w;
                  return (
                    <div key={i} className="rounded-xl bg-white border border-gray-200 p-4">
                      <div ref={(el) => { imageRefs.current[refKey] = el; }} className="rounded-lg overflow-hidden" style={{ aspectRatio: `${w}/${h}`, maxHeight: 200 }}>
                        <div className="w-full h-full bg-navy flex flex-col items-center justify-center p-4 text-center" style={{ aspectRatio: `${w}/${h}` }}>
                          <p className="text-white font-bold text-sm whitespace-pre-line leading-relaxed">{sub(post.imageText)}</p>
                          <p className="mt-2 text-xs" style={{ color: partner?.accentColor || "#C9A84C" }}>{partner?.companyName || "Company"}</p>
                        </div>
                      </div>
                      <h4 className="mt-3 text-xs font-semibold text-navy">{post.title}</h4>
                      <p className="mt-1 text-xs text-charcoal/50 line-clamp-3">{sub(post.caption).substring(0, 100)}...</p>
                      <div className="mt-3 flex gap-2">
                        <LockButton onClick={() => copyText(post.caption, refKey)} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-charcoal/70 hover:bg-gray-50">
                          {copied === refKey ? "Copied!" : "Copy Caption"}
                        </LockButton>
                        <LockButton onClick={() => downloadImage(refKey, `${platform}-${post.title.toLowerCase().replace(/\s/g, "-")}.png`)} className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white hover:bg-gold/90">
                          Download Image
                        </LockButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}
      </div>

      {/* PRINT MATERIALS */}
      <div className={showPrint ? "" : "hidden"}>
      {true && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-navy">Print Materials</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {materialsLoading && Array.from({ length: 3 }).map((_, i) => (
              <div key={`sk-${i}`} className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                <div className="h-48 bg-gray-100 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-2/3 bg-gray-100 rounded animate-pulse" />
                  <div className="h-2 w-full bg-gray-100 rounded animate-pulse" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-7 flex-1 bg-gray-100 rounded-full animate-pulse" />
                    <div className="h-7 flex-1 bg-gray-100 rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
            {!materialsLoading && materials.filter((m) => m.category === "print").map((m) => (
              <div key={m.id} className="group rounded-xl bg-white border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <button
                  type="button"
                  onClick={() => window.open(m.url, "_blank")}
                  className="block w-full h-48 bg-gray-50 relative overflow-hidden"
                  title="Open preview"
                >
                  <iframe
                    src={`${m.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    title={m.title}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-navy">{m.title}</h3>
                    {m.isGlobal && <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold shrink-0">Global</span>}
                  </div>
                  {m.description && <p className="mt-1 text-xs text-charcoal/50">{m.description}</p>}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => window.open(m.url, "_blank")} className="flex-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-charcoal/70 hover:bg-gray-50">
                      Preview
                    </button>
                    <a href={m.url} download className="flex-1 rounded-full bg-gold px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-gold/90">
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
            {!materialsLoading && materials.filter((m) => m.category === "print").length === 0 && (
              <p className="col-span-full text-sm text-charcoal/50">No print materials available yet.</p>
            )}
          </div>
        </div>
      )}
      </div>

      {/* PRESENTATIONS */}
      {showPres && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-navy">Presentations</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-gray-200 p-5">
              <div className="bg-navy rounded-lg p-6 text-center mb-4" style={{ aspectRatio: "16/9" }}>
                <p className="text-xs text-white/60">{partner?.companyName || "Company"}</p>
                <p className="text-base font-bold text-white mt-2">Introducing {partner?.productName || "Legacy Protection"}</p>
                <p className="text-xs text-white/70 mt-1">Attorney-Reviewed Estate Planning</p>
                <p className="text-sm font-bold mt-3" style={{ color: partner?.accentColor || "#C9A84C" }}>Will: $400 &middot; Trust: $600</p>
              </div>
              <h3 className="text-sm font-bold text-navy">Client Presentation Slide</h3>
              <p className="mt-1 text-xs text-charcoal/50">Drop into your existing presentations.</p>
              <LockButton className="mt-3 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold/90">Download PNG</LockButton>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-5">
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
                <p className="text-xs font-bold text-navy">{partner?.productName || "Legacy Protection"}</p>
                <p className="text-xs text-charcoal/60 mt-2">Attorney-reviewed estate planning for your clients. Will Package $400. Trust Package $600. Includes a secure Family Vault.</p>
                <p className="text-xs mt-2" style={{ color: partner?.accentColor || "#C9A84C" }}>{partner?.businessUrl ? `legacy.${partner.businessUrl}` : "estatevault.com"}</p>
              </div>
              <h3 className="text-sm font-bold text-navy">Client One-Pager</h3>
              <p className="mt-1 text-xs text-charcoal/50">Leave-behind for client meetings.</p>
              <LockButton onClick={() => window.open("/api/marketing/one-pager", "_blank")} className="mt-3 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold/90">Download PDF</LockButton>
            </div>
          </div>
        </div>
      )}

      {/* Email preview modal */}
      {previewEmail !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewEmail(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">{EMAIL_TEMPLATES[previewEmail].name}</h3>
              <button onClick={() => setPreviewEmail(null)} className="text-charcoal/60 hover:text-charcoal text-xl">×</button>
            </div>
            <div className="p-6">
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <p className="text-sm font-medium text-navy">{partner?.companyName || "Company"} <span className="text-charcoal/50 font-normal">&lt;{partner?.email || "email"}&gt;</span></p>
                  <p className="text-xs text-charcoal/60 mt-1">{sub(EMAIL_TEMPLATES[previewEmail].subject)}</p>
                </div>
                <div className="p-4">
                  <div className="h-2 w-24 rounded" style={{ background: partner?.accentColor || "#C9A84C" }} />
                  <pre className="mt-4 whitespace-pre-wrap text-sm text-charcoal/80 leading-relaxed font-sans">{sub(EMAIL_TEMPLATES[previewEmail].body)}</pre>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <button onClick={() => { copyText(EMAIL_TEMPLATES[previewEmail].body, `email-modal`); }} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90">
                {copied === "email-modal" ? "Copied!" : "Copy Email"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
