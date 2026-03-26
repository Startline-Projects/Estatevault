import Link from "next/link";

const packages = [
  {
    title: "Will Package",
    price: "$400",
    popular: false,
    features: [
      "Last Will & Testament",
      "Durable Power of Attorney",
      "Healthcare Directive",
      "Execution Guide",
      "Family Vault Access",
    ],
    cta: "Get Started",
    href: "/will",
    ctaClass: "bg-navy text-white hover:bg-navy/90",
  },
  {
    title: "Trust Package",
    price: "$600",
    popular: true,
    features: [
      "Revocable Living Trust",
      "Pour-Over Will",
      "Durable Power of Attorney",
      "Healthcare Directive",
      "Asset Funding Checklist",
      "Family Vault Access",
      "Attorney Review Available",
    ],
    cta: "Get Started",
    href: "/trust",
    ctaClass: "bg-gold text-white hover:bg-gold/90",
  },
];

export default function PackageCards() {
  return (
    <section id="pricing" className="bg-gray-50 py-20 px-6">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-navy">
          Choose Your Plan
        </h2>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8">
          {packages.map((pkg) => (
            <div
              key={pkg.title}
              className="relative rounded-2xl bg-white border border-gray-200 p-8 text-left shadow-sm hover:shadow-md transition-shadow"
            >
              {pkg.popular && (
                <span className="absolute -top-3 right-6 rounded-full bg-gold px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold text-navy">{pkg.title}</h3>
              <p className="mt-2 text-4xl font-bold text-navy">{pkg.price}</p>

              <ul className="mt-6 space-y-3">
                {pkg.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-charcoal/80">
                    <span className="mt-0.5 text-gold font-bold">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={pkg.href}
                className={`mt-8 block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors ${pkg.ctaClass}`}
              >
                {pkg.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
