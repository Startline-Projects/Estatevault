import Link from "next/link";

const categories = [
  { icon: "📄", label: "Estate Documents" },
  { icon: "🏦", label: "Financial Accounts" },
  { icon: "🛡", label: "Insurance Policies" },
  { icon: "🔑", label: "Digital Accounts & Passwords" },
  { icon: "📍", label: "Physical Document Locations" },
  { icon: "👤", label: "Important Contacts" },
];

export default function VaultSection() {
  return (
    <section id="vault" className="bg-navy py-20 px-6">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white">
          More Than Documents — A Complete Family Vault
        </h2>
        <p className="mt-4 text-lg text-blue-100/70 max-w-2xl mx-auto">
          Everything your family needs to find when it matters most.
        </p>

        <div className="mt-14 grid grid-cols-2 md:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.label}
              className="rounded-xl bg-navy/60 border border-white/10 p-6 text-center hover:border-gold/40 transition-colors"
            >
              <span className="text-3xl">{cat.icon}</span>
              <p className="mt-3 text-sm font-medium text-white">{cat.label}</p>
            </div>
          ))}
        </div>

        <Link
          href="/vault"
          className="mt-12 inline-flex items-center rounded-full border border-gold px-8 py-3 text-sm font-semibold text-gold hover:bg-gold hover:text-white transition-colors"
        >
          Learn More About the Vault
        </Link>
      </div>
    </section>
  );
}
