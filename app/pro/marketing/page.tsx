"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { substituteTokens, type PartnerData } from "@/lib/marketing/substitute";

const TABS = ["All", "Scripts", "Email", "Social Media", "Print Materials", "Presentations"];

const SCRIPT_CONTENT = `APPROVED INTRODUCTION SCRIPT

USE THIS WORD FOR WORD:

"[Client name], one thing I want to make sure we cover today is your estate plan. A lot of my clients have been using a platform called [Product Name] to get their wills and trusts done quickly and affordably. It generates attorney-reviewed documents — takes about 15 minutes. Would you like me to walk you through it?"

IF THEY ASK "Are you my lawyer?":

"No — I'm not acting as your attorney, and this platform doesn't provide legal advice. What it does is generate attorney-reviewed estate planning documents based on your answers. If you have complex legal questions, we can connect you with a licensed estate planning attorney."

IF THEY ASK "Is this legitimate?":

"Yes — all documents are based on attorney-approved templates specific to [State]. They're the same documents an estate planning attorney would prepare, at a fraction of the cost."

NEVER SAY:
✗ "I recommend you get a trust"
✗ "You should do this"
✗ "As your advisor I think you need..."
✗ "This is legal advice"
✗ "I'm helping you with your legal plan"`;

const EMAIL_TEMPLATES = [
  { name: "Client Introduction", useCase: "Send to your client list to introduce your estate planning service", subject: "Protect your family — estate planning made simple", body: `Hi [First Name],

I wanted to share something I've been offering clients that has gotten a great response.

[Product Name] makes it simple to create a professional estate plan — a will or revocable trust — in about 15 minutes, from the comfort of your home.

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
  { name: "7-Day Follow-Up", useCase: "Send to clients who haven't responded", subject: "Quick follow-up — your estate plan", body: `Hi [First Name],

I wanted to follow up on my note from last week about estate planning.

Many of my clients have been surprised by how quick and affordable this has become. Most finish in under 15 minutes.

[Product Name] generates attorney-reviewed documents for $400 (will) or $600 (trust) — a fraction of traditional attorney costs.

Your family's protection shouldn't wait.

Get started at [white-label URL]

Best,
[Partner Name]` },
  { name: "Annual Review Reminder", useCase: "Send to existing clients 12 months after their estate plan", subject: "Time to review your estate plan", body: `Hi [First Name],

It's been about a year since you created your estate plan through [Product Name].

A lot can change in a year — new assets, family changes, address changes. We recommend a quick annual review to make sure your plan is still current.

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

[Product Name] includes a secure Family Vault where clients store everything their family will need — documents, accounts, policies, digital credentials.

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

Through [Company Name], you can create a complete estate plan — will or trust — in about 15 minutes. Attorney-reviewed documents, specific to [State].

Will Package: $400
Trust Package: $600

Have questions? Send me a message.

[white-label URL]`, imageText: "Protect Your Family\nin 15 Minutes", size: "1200x630" },
    { title: "Question Hook", caption: `Quick question for my [City] friends:

Do you have a will? Most people don't — and it means the state decides what happens to your assets and who raises your children.

I've been helping families solve this quickly and affordably. Message me to learn more. 💛`, imageText: "Do you have a will?\nMost people don't.", size: "1200x630" },
    { title: "Simple CTA", caption: `The most important financial document your family needs isn't an investment account.

It's a will or trust.

I help families in [City] create complete estate plans through [Product Name] — attorney-reviewed, affordable, and done in 15 minutes.

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

  const showScripts = tab === "All" || tab === "Scripts";
  const showEmail = tab === "All" || tab === "Email";
  const showSocial = tab === "All" || tab === "Social Media";
  const showPrint = tab === "All" || tab === "Print Materials";
  const showPres = tab === "All" || tab === "Presentations";

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-navy">Marketing Tools</h1>
      <p className="mt-1 text-sm text-charcoal/60">Everything you need to introduce Legacy Protection to your clients. All materials are pre-branded for you — download and use immediately.</p>

      {!certified && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
          <p className="text-sm text-amber-800">⚠ Complete your certification training to unlock all marketing materials. The Compliance Script Card is available now.</p>
          <Link href="/pro/training" className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 shrink-0 ml-4">Complete Certification →</Link>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap ${tab === t ? "bg-navy text-white" : "bg-gray-100 text-charcoal/60 hover:bg-gray-200"}`}>{t}</button>)}
      </div>

      {/* SCRIPTS */}
      {showScripts && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-navy">Compliance Script Card</h2>
          <div className="mt-3 rounded-xl border-2 border-gold bg-gold/5 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="rounded-full bg-gold px-3 py-0.5 text-xs font-bold text-white">START HERE</span>
              <span className="text-xs text-charcoal/50">Always available — no certification required</span>
            </div>
            <h3 className="text-base font-bold text-navy">Compliance Script Card</h3>
            <p className="mt-1 text-sm text-charcoal/60">Word-for-word approved scripts for introducing estate planning. What to say. What NOT to say. Print and keep at your desk.</p>
            <button onClick={() => setExpandScript(!expandScript)} className="mt-3 text-sm text-gold font-medium">{expandScript ? "Hide Preview ▲" : "Show Preview ▼"}</button>
            {expandScript && (
              <pre className="mt-4 whitespace-pre-wrap text-sm text-charcoal/80 bg-white rounded-lg p-4 border border-gray-200 leading-relaxed">{sub(SCRIPT_CONTENT)}</pre>
            )}
            <div className="mt-4 flex gap-3">
              <a href={`/api/marketing/script-card`} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90">Download PDF</a>
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
      {showSocial && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-navy">Social Media Posts</h2>
          {(["linkedin", "facebook", "instagram"] as const).map((platform) => (
            <div key={platform} className="mt-4">
              <h3 className="text-sm font-semibold text-navy capitalize">{platform}</h3>
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
          ))}
        </div>
      )}

      {/* PRINT MATERIALS */}
      {showPrint && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-navy">Print Materials</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Client Flyer", desc: "8.5x11 flyer for waiting rooms and client meetings.", href: "/api/marketing/flyer" },
              { title: "Trifold Brochure", desc: "Professional brochure for client packets.", href: "/api/marketing/flyer" },
              { title: "Business Card Insert", desc: "3.5x2 card to include with business cards.", href: "/api/marketing/flyer" },
            ].map((asset) => (
              <div key={asset.title} className="rounded-xl bg-white border border-gray-200 p-5">
                <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center mb-4">
                  <div className="text-center">
                    <p className="text-xs font-bold text-navy">{partner?.companyName || "Company"}</p>
                    <p className="text-xs text-charcoal/50 mt-1">Estate Planning</p>
                    <p className="text-xs mt-2" style={{ color: partner?.accentColor || "#C9A84C" }}>$400 / $600</p>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-navy">{asset.title}</h3>
                <p className="mt-1 text-xs text-charcoal/50">{asset.desc}</p>
                <LockButton onClick={() => { window.open(asset.href, "_blank"); }} className="mt-3 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold/90">
                  Download PDF
                </LockButton>
              </div>
            ))}
          </div>
        </div>
      )}

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
  );
}
