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
  const subtext = isDark ? "rgba(255,255,255,0.7)" : "#666666";
  const cardBg = isDark ? "rgba(255,255,255,0.06)" : "#f8f9fa";
  const productName = partner.product_name || "Secure Vault";
  const tagline = partner.vault_tagline || "Protect what matters most for the people you love.";
  const signupUrl = `/auth/signup?partner=${slug}&redirect=/dashboard/vault`;
  const loginUrl = `/auth/login?partner=${slug}&redirect=/dashboard/vault`;

  return (
    <div style={{ backgroundColor: bg, minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <header style={{ backgroundColor: bg, borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#f0f0f0"}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {partner.logo_url ? (
              <Image src={partner.logo_url} alt={partner.company_name} width={120} height={40} style={{ objectFit: "contain", maxHeight: 40 }} />
            ) : (
              <span style={{ fontSize: 18, fontWeight: 700, color: accent }}>{partner.company_name}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href={loginUrl} style={{ fontSize: 14, color: subtext, textDecoration: "none" }}>Sign In</Link>
            <Link
              href={signupUrl}
              style={{ fontSize: 14, fontWeight: 600, color: "#fff", backgroundColor: accent, padding: "8px 20px", borderRadius: 999, textDecoration: "none" }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px 64px", textAlign: "center" }}>
        <div style={{ display: "inline-block", backgroundColor: `${accent}20`, color: accent, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 999, marginBottom: 20, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Secure · Private · Trusted
        </div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, color: text, margin: "0 0 20px", lineHeight: 1.15 }}>
          {productName}
        </h1>
        <p style={{ fontSize: 18, color: subtext, maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
          {tagline}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href={signupUrl}
            style={{ fontSize: 15, fontWeight: 700, color: "#fff", backgroundColor: accent, padding: "14px 32px", borderRadius: 999, textDecoration: "none" }}
          >
            Secure My Documents →
          </Link>
          <Link
            href={loginUrl}
            style={{ fontSize: 15, fontWeight: 600, color: text, backgroundColor: "transparent", padding: "14px 32px", borderRadius: 999, border: `2px solid ${isDark ? "rgba(255,255,255,0.2)" : "#e5e7eb"}`, textDecoration: "none" }}
          >
            Sign In
          </Link>
        </div>
        <p style={{ fontSize: 13, color: subtext, marginTop: 16 }}>
          $99/year · Cancel anytime · 256-bit encryption
        </p>
      </section>

      {/* Features Grid */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 700, color: text, marginBottom: 12 }}>
          Everything in one secure place
        </h2>
        <p style={{ textAlign: "center", color: subtext, marginBottom: 48, fontSize: 16 }}>
          Six categories to organize and protect your most important information.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {VAULT_FEATURES.map((f) => (
            <div key={f.title} style={{ backgroundColor: cardBg, borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 8px" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: subtext, margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trustee Section */}
      <section style={{ backgroundColor: cardBg, padding: "64px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: text, marginBottom: 16 }}>
            Trusted access for when it matters most
          </h2>
          <p style={{ fontSize: 16, color: subtext, lineHeight: 1.7, marginBottom: 32 }}>
            Designate up to 2 trustees who can request access to your vault in an emergency.
            Each access request requires 72-hour review and identity verification —
            so your information stays protected until it&apos;s truly needed.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {["72-hour review window", "Identity verification required", "Full audit trail", "You control who has access"].map((item) => (
              <div key={item} style={{ backgroundColor: `${accent}20`, color: accent, fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 999 }}>
                ✓ {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / CTA */}
      <section style={{ maxWidth: 560, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ backgroundColor: cardBg, borderRadius: 24, padding: "48px 40px" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: text, marginBottom: 8 }}>
            Start protecting your family today
          </h2>
          <div style={{ fontSize: 48, fontWeight: 800, color: accent, margin: "24px 0 4px" }}>$99</div>
          <p style={{ color: subtext, marginBottom: 32, fontSize: 15 }}>per year · no setup fee</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", textAlign: "left" }}>
            {[
              "Unlimited vault storage",
              "Up to 2 designated trustees",
              "Farewell video messages",
              "256-bit AES encryption",
              "Separate vault PIN",
              "Cancel anytime",
            ].map((item) => (
              <li key={item} style={{ fontSize: 15, color: text, padding: "8px 0", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#f0f0f0"}`, display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: accent, fontWeight: 700 }}>✓</span> {item}
              </li>
            ))}
          </ul>
          <Link
            href={signupUrl}
            style={{ display: "block", fontSize: 16, fontWeight: 700, color: "#fff", backgroundColor: accent, padding: "16px 32px", borderRadius: 999, textDecoration: "none" }}
          >
            Get Started — $99/year
          </Link>
          <p style={{ fontSize: 12, color: subtext, marginTop: 12 }}>
            Powered by EstateVault · Bank-grade security
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#f0f0f0"}`, padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: subtext, margin: 0 }}>
          {partner.company_name} · Powered by{" "}
          <a href="https://www.estatevault.us" style={{ color: accent, textDecoration: "none" }}>EstateVault</a>
          {" "}·{" "}
          <a href="/privacy" style={{ color: subtext, textDecoration: "none" }}>Privacy</a>
          {" "}·{" "}
          <a href="/terms" style={{ color: subtext, textDecoration: "none" }}>Terms</a>
        </p>
      </footer>

    </div>
  );
}
