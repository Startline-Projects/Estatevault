import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import Link from "next/link";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export default async function PartnerLandingPage({
  params,
}: {
  params: { "partner-slug": string };
}) {
  const slug = params["partner-slug"];

  // Skip known app routes
  const reserved = ["pro", "auth", "dashboard", "quiz", "will", "trust", "api", "attorney-referral"];
  if (reserved.includes(slug)) return redirect("/");

  const supabase = createAdminClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("id, company_name, product_name, logo_url, accent_color, partner_slug")
    .eq("partner_slug", slug)
    .eq("status", "active")
    .single();

  if (!partner) return redirect("/");

  const accentColor = partner.accent_color || "#C9A84C";
  const productName = partner.product_name || "Legacy Protection";
  const companyName = partner.company_name;
  const partnerId = partner.id;

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b" style={{ borderColor: accentColor + "40" }}>
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {partner.logo_url ? (
              <img src={partner.logo_url} alt={companyName} className="h-8" />
            ) : (
              <span className="text-xl font-bold text-navy">{companyName}</span>
            )}
            <span className="text-sm text-charcoal/50">{productName}</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm font-medium text-charcoal hover:text-navy">How It Works</a>
            <a href="#pricing" className="text-sm font-medium text-charcoal hover:text-navy">Pricing</a>
            <a href="#faq" className="text-sm font-medium text-charcoal hover:text-navy">FAQ</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-navy py-20 px-6 md:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">Protect Your Family. It Takes 15 Minutes.</h1>
          <p className="mt-6 text-lg md:text-xl text-blue-100/80 max-w-2xl mx-auto">Attorney-reviewed wills and trusts, built for Michigan. Secure. Simple. Complete with your family&apos;s vault.</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`/quiz?partner=${partnerId}`} className="rounded-full px-8 py-3.5 text-base font-semibold text-white shadow-lg" style={{ background: accentColor }}>Take the Free Quiz</Link>
            <div className="flex gap-3">
              <Link href={`/will?partner=${partnerId}`} className="rounded-full border border-white/60 px-6 py-3 text-sm font-medium text-white hover:bg-white/10">Create a Will</Link>
              <Link href={`/trust?partner=${partnerId}`} className="rounded-full border border-white/60 px-6 py-3 text-sm font-medium text-white hover:bg-white/10">Create a Trust</Link>
            </div>
          </div>
          <p className="mt-8 text-sm text-blue-100/60">🔒 Attorney-Reviewed &middot; State-Specific &middot; SSL Secured</p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white py-20 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold text-navy">How It Works</h2>
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { n: 1, t: "Answer a few questions", d: "Our smart quiz learns about your family in plain English." },
              { n: 2, t: "We build your documents", d: "Attorney-reviewed templates create your personalized plan." },
              { n: 3, t: "Protect everything", d: "Your documents and your family\u2019s vault, all in one place." },
            ].map((s) => (
              <div key={s.n} className="flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full text-white text-xl font-bold" style={{ background: accentColor }}>{s.n}</div>
                <h3 className="mt-5 text-lg font-semibold text-navy">{s.t}</h3>
                <p className="mt-2 text-sm text-charcoal/70 max-w-xs">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-navy">Choose Your Plan</h2>
          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { title: "Will Package", price: "$400", features: ["Last Will & Testament", "Durable Power of Attorney", "Healthcare Directive", "Execution Guide", "Family Vault Access"], href: `/will?partner=${partnerId}` },
              { title: "Trust Package", price: "$600", badge: true, features: ["Revocable Living Trust", "Pour-Over Will", "Durable Power of Attorney", "Healthcare Directive", "Asset Funding Checklist", "Family Vault Access"], href: `/trust?partner=${partnerId}` },
            ].map((pkg) => (
              <div key={pkg.title} className="relative rounded-2xl bg-white border border-gray-200 p-8 text-left shadow-sm">
                {pkg.badge && <span className="absolute -top-3 right-6 rounded-full px-4 py-1 text-xs font-semibold text-white" style={{ background: accentColor }}>Most Popular</span>}
                <h3 className="text-xl font-bold text-navy">{pkg.title}</h3>
                <p className="mt-2 text-4xl font-bold text-navy">{pkg.price}</p>
                <ul className="mt-6 space-y-3">
                  {pkg.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-charcoal/80"><span className="mt-0.5 font-bold" style={{ color: accentColor }}>✓</span>{f}</li>)}
                </ul>
                <Link href={pkg.href} className="mt-8 block w-full rounded-lg py-3 text-center text-sm font-semibold text-white" style={{ background: pkg.badge ? accentColor : "#1C3557" }}>Get Started</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-navy text-center">Common Questions</h2>
          <div className="mt-12 space-y-4">
            {[
              { q: "Are these real legal documents?", a: "Yes. All documents are attorney-reviewed, Michigan-specific, and legally valid when properly executed." },
              { q: "How long does it take?", a: "Most clients complete the quiz in 10\u201315 minutes. Documents are generated immediately after purchase." },
              { q: "Is my information secure?", a: "Yes. All data is protected with 256-bit AES encryption. Bank-grade security standards." },
            ].map((faq) => (
              <details key={faq.q} className="rounded-xl border border-gray-200 p-5">
                <summary className="text-sm font-medium text-navy cursor-pointer">{faq.q}</summary>
                <p className="mt-3 text-sm text-charcoal/70">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy/95 py-12 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-lg font-bold text-white">{companyName}</p>
              <p className="mt-1 text-sm text-gray-400">{productName}</p>
            </div>
            <p className="text-xs text-gray-500">Powered by EstateVault</p>
          </div>
          <hr className="my-8 border-white/10" />
          <p className="text-xs text-gray-500 leading-relaxed">
            This platform provides document preparation services only. It does not provide legal advice. No attorney-client relationship is created by your use of this platform.
          </p>
        </div>
      </footer>
    </>
  );
}
