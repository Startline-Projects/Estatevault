import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

const VAULT_FEATURES = [
  { icon: "📄", title: "Estate Documents", desc: "Store wills, trusts, and legal documents securely." },
  { icon: "🛡️", title: "Insurance Policies", desc: "Keep all policy details in one protected place." },
  { icon: "🏦", title: "Financial Accounts", desc: "Record account details for your loved ones." },
  { icon: "🔐", title: "Digital Credentials", desc: "Securely store passwords and digital asset access." },
  { icon: "🏠", title: "Physical Assets", desc: "Document property locations and access instructions." },
  { icon: "💌", title: "Farewell Messages", desc: "Leave personal video or written messages for family." },
];

const STEPS = [
  { n: "1", title: "Create your vault", desc: "Sign up and set a separate vault PIN — your private key, never shared." },
  { n: "2", title: "Add what matters", desc: "Upload documents, record accounts, and leave messages across six categories." },
  { n: "3", title: "Name your trustees", desc: "Choose up to 2 people who can request access when the time comes." },
];

const FAQ = [
  { q: "Who can see my vault?", a: "Only you. Your vault is protected by a separate PIN and 256-bit AES encryption. Trustees can only request access — never view it freely." },
  { q: "What happens when a trustee requests access?", a: "Every request triggers a 72-hour review window and identity verification. You stay in control until access is truly needed." },
  { q: "Can I cancel?", a: "Yes — cancel anytime from your account settings. No setup fees, no long-term commitment." },
  { q: "Is my data really secure?", a: "Your information is encrypted with bank-grade 256-bit AES encryption, both in transit and at rest." },
];

export default async function VaultLandingPage({
  params,
}: {
  params: { "partner-slug": string };
}) {
  const slug = params["partner-slug"];
  const supabase = createAdminClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("id, tier, company_name, product_name, logo_url, accent_color, vault_tagline, vault_theme, partner_slug")
    .eq("partner_slug", slug)
    .in("status", ["active", "onboarding"])
    .single();

  // Vault page only for basic tier partners
  if (!partner || (partner.tier !== "basic" && process.env.NODE_ENV === "production")) return redirect("/");

  const accent = partner.accent_color || "#C9A84C";
  const isDark = partner.vault_theme === "dark";
  const bg = isDark ? "#1C3557" : "#ffffff";
  const text = isDark ? "#ffffff" : "#1C3557";
  const subtext = isDark ? "rgba(255,255,255,0.7)" : "#5b6472";
  const cardBg = isDark ? "rgba(255,255,255,0.06)" : "#f8f9fb";
  const border = isDark ? "rgba(255,255,255,0.1)" : "#ebedf0";
  const productName = partner.product_name || "Secure Vault";
  const tagline = partner.vault_tagline || "Protect what matters most for the people you love.";
  const signupUrl = `/auth/signup?partner=${slug}&redirect=/dashboard/vault`;
  const loginUrl = `/auth/login?partner=${slug}&redirect=/dashboard/vault`;

  return (
    <div style={{ backgroundColor: bg, minHeight: "100vh", fontFamily: "Inter, sans-serif", color: text }}>
      <style>{`
        @keyframes evFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .ev-fade { animation: evFadeUp .5s cubic-bezier(.16,1,.3,1) both; }
        .ev-card { transition: transform .2s ease, box-shadow .2s ease; }
        .ev-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,.10); }
        .ev-cta { transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease; }
        .ev-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 24px ${accent}55; }
        .ev-ghost { transition: border-color .15s ease, color .15s ease; }
        .ev-ghost:hover { border-color: ${accent}; color: ${accent}; }
        .ev-link { transition: color .15s ease; }
        .ev-link:hover { color: ${accent}; }
        .ev-faq summary { cursor: pointer; list-style: none; }
        .ev-faq summary::-webkit-details-marker { display: none; }
        .ev-faq[open] .ev-faq-icon { transform: rotate(45deg); }
        .ev-faq-icon { transition: transform .2s ease; }
        @media (prefers-reduced-motion: reduce) {
          .ev-fade, .ev-card, .ev-cta, .ev-ghost, .ev-faq-icon { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: isDark ? "rgba(28,53,87,0.92)" : "rgba(255,255,255,0.92)", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {partner.logo_url ? (
              <Image src={partner.logo_url} alt={partner.company_name} width={120} height={40} style={{ objectFit: "contain", maxHeight: 40 }} />
            ) : (
              <span style={{ fontSize: 18, fontWeight: 700, color: accent }}>{partner.company_name}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link href={loginUrl} className="ev-link" style={{ fontSize: 14, fontWeight: 500, color: subtext, textDecoration: "none" }}>Sign In</Link>
            <Link
              href={signupUrl}
              className="ev-cta"
              style={{ fontSize: 14, fontWeight: 600, color: "#fff", backgroundColor: accent, padding: "9px 20px", borderRadius: 999, textDecoration: "none" }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="ev-fade" style={{ maxWidth: 760, margin: "0 auto", padding: "88px 24px 56px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: `${accent}1a`, color: accent, fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 999, marginBottom: 24, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          🔒 Secure · Private · Trusted
        </div>
        <h1 style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontWeight: 800, color: text, margin: "0 0 20px", lineHeight: 1.12, letterSpacing: "-0.02em" }}>
          {productName}
        </h1>
        <p style={{ fontSize: 19, color: subtext, maxWidth: 540, margin: "0 auto 36px", lineHeight: 1.65 }}>
          {tagline}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href={signupUrl}
            className="ev-cta"
            style={{ fontSize: 15, fontWeight: 700, color: "#fff", backgroundColor: accent, padding: "15px 32px", borderRadius: 999, textDecoration: "none" }}
          >
            Secure My Documents →
          </Link>
          <Link
            href={loginUrl}
            className="ev-ghost"
            style={{ fontSize: 15, fontWeight: 600, color: text, backgroundColor: "transparent", padding: "15px 32px", borderRadius: 999, border: `2px solid ${border}`, textDecoration: "none" }}
          >
            Sign In
          </Link>
        </div>
        <div style={{ display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap", fontSize: 13, color: subtext, marginTop: 20 }}>
          <span>✓ $99/year</span>
          <span>✓ Cancel anytime</span>
          <span>✓ 256-bit encryption</span>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 80px" }}>
        <h2 style={{ textAlign: "center", fontSize: 30, fontWeight: 800, color: text, marginBottom: 12, letterSpacing: "-0.02em" }}>
          Everything in one secure place
        </h2>
        <p style={{ textAlign: "center", color: subtext, marginBottom: 44, fontSize: 16 }}>
          Six categories to organize and protect your most important information.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {VAULT_FEATURES.map((f) => (
            <div key={f.title} className="ev-card" style={{ backgroundColor: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 12, backgroundColor: `${accent}1a`, fontSize: 24, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 8px" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: subtext, margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ backgroundColor: cardBg, padding: "72px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 30, fontWeight: 800, color: text, marginBottom: 12, letterSpacing: "-0.02em" }}>
            How it works
          </h2>
          <p style={{ textAlign: "center", color: subtext, marginBottom: 44, fontSize: 16 }}>
            Three steps to peace of mind.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 999, backgroundColor: accent, color: "#fff", fontSize: 18, fontWeight: 800, margin: "0 auto 16px" }}>{s.n}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: text, margin: "0 0 8px" }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: subtext, margin: 0, lineHeight: 1.65 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trustee Section */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 999, backgroundColor: `${accent}1a`, fontSize: 32, marginBottom: 20 }}>🔒</div>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: text, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Trusted access for when it matters most
          </h2>
          <p style={{ fontSize: 16, color: subtext, lineHeight: 1.7, marginBottom: 32, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
            Designate up to 2 trustees who can request access to your vault in an emergency.
            Each access request requires 72-hour review and identity verification —
            so your information stays protected until it&apos;s truly needed.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {["72-hour review window", "Identity verification required", "Full audit trail", "You control who has access"].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: `${accent}1a`, color: accent, fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 999 }}>
                ✓ {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / CTA */}
      <section style={{ maxWidth: 560, margin: "0 auto", padding: "24px 24px 80px", textAlign: "center" }}>
        <div className="ev-card" style={{ backgroundColor: cardBg, border: `1px solid ${border}`, borderRadius: 24, padding: "48px 40px", boxShadow: "0 12px 40px rgba(0,0,0,.06)" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: text, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Start protecting your family today
          </h2>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, margin: "24px 0 4px" }}>
            <span style={{ fontSize: 52, fontWeight: 800, color: accent }}>$99</span>
            <span style={{ fontSize: 16, color: subtext, fontWeight: 600 }}>/ year</span>
          </div>
          <p style={{ color: subtext, marginBottom: 32, fontSize: 14 }}>no setup fee · cancel anytime</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", textAlign: "left" }}>
            {[
              "Unlimited vault storage",
              "Up to 2 designated trustees",
              "Farewell video messages",
              "256-bit AES encryption",
              "Separate vault PIN",
              "Cancel anytime",
            ].map((item) => (
              <li key={item} style={{ fontSize: 15, color: text, padding: "10px 0", borderBottom: `1px solid ${border}`, display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 999, backgroundColor: `${accent}1a`, color: accent, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>✓</span> {item}
              </li>
            ))}
          </ul>
          <Link
            href={signupUrl}
            className="ev-cta"
            style={{ display: "block", fontSize: 16, fontWeight: 700, color: "#fff", backgroundColor: accent, padding: "16px 32px", borderRadius: 999, textDecoration: "none" }}
          >
            Get Started — $99/year
          </Link>
          <p style={{ fontSize: 12, color: subtext, marginTop: 14 }}>
            Powered by EstateVault · Bank-grade security
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ backgroundColor: cardBg, padding: "72px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 30, fontWeight: 800, color: text, marginBottom: 44, letterSpacing: "-0.02em" }}>
            Frequently asked questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQ.map((item) => (
              <details key={item.q} className="ev-faq" style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "16px 20px" }}>
                <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 16, fontWeight: 600, color: text }}>
                  {item.q}
                  <span className="ev-faq-icon" style={{ color: accent, fontSize: 20, fontWeight: 700, flexShrink: 0 }}>+</span>
                </summary>
                <p style={{ fontSize: 14, color: subtext, lineHeight: 1.7, margin: "12px 0 0" }}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${border}`, padding: "32px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: subtext, margin: 0 }}>
          {partner.company_name} · Powered by{" "}
          <a href="https://www.estatevault.us" className="ev-link" style={{ color: accent, textDecoration: "none" }}>EstateVault</a>
          {" "}·{" "}
          <a href="/privacy" className="ev-link" style={{ color: subtext, textDecoration: "none" }}>Privacy</a>
          {" "}·{" "}
          <a href="/terms" className="ev-link" style={{ color: subtext, textDecoration: "none" }}>Terms</a>
        </p>
      </footer>

    </div>
  );
}
