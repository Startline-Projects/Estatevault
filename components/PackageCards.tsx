import Link from "next/link";

const packages = [
  {
    title: "Will Package",
    descriptor: "Direct your wishes through the court",
    price: "$400",
    popular: false,
    features: [
      "Last Will & Testament",
      "Durable Power of Attorney",
      "Healthcare Directive",
      "Execution Guide",
      "Family Vault Access",
    ],
    cta: "Begin Your Will",
    href: "/will",
  },
  {
    title: "Trust Package",
    descriptor: "Bypass probate and protect privately",
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
    cta: "Begin Your Trust",
    href: "/trust",
  },
];

export default function PackageCards() {
  return (
    <section id="pricing" className="relative bg-gradient-to-b from-gray-50 to-white py-24 px-6">
      <div className="mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-gold-50 px-4 py-1.5 mb-4">
          <span className="text-xs font-semibold text-gold-700 tracking-wide uppercase">One-Time Payment</span>
        </div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-navy tracking-tight">
          Simple, Honest Pricing
        </h2>
        <p className="mt-4 text-lg text-charcoal/60 max-w-xl mx-auto">
          Pay once. No subscriptions, no hidden fees, no surprises.
        </p>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          {packages.map((pkg) => (
            <div
              key={pkg.title}
              className={`relative group rounded-2xl bg-white p-8 text-left transition-all duration-300 hover:-translate-y-1 ${
                pkg.popular
                  ? "border-2 border-gold shadow-gold hover:shadow-gold-lg"
                  : "border border-gray-200 shadow-premium hover:shadow-premium-lg hover:border-navy/20"
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-gold to-gold-400 px-5 py-1.5 text-xs font-bold text-white shadow-gold animate-shimmer">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="text-xl font-bold text-navy">{pkg.title}</h3>
              <p className="mt-1 text-sm text-charcoal/50">{pkg.descriptor}</p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold text-navy tracking-tight">{pkg.price}</span>
                <span className="text-sm text-charcoal/50 ml-1">one-time</span>
              </div>

              <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

              <ul className="mt-6 space-y-3.5">
                {pkg.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-charcoal/70">
                    <svg className="mt-0.5 w-5 h-5 text-gold shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={pkg.href}
                className={`mt-8 block w-full rounded-xl py-3.5 text-center text-sm font-semibold transition-all duration-200 ${
                  pkg.popular
                    ? "bg-gold text-white hover:bg-gold-600 shadow-gold hover:shadow-gold-lg hover:scale-[1.01]"
                    : "bg-navy text-white hover:bg-navy-800 shadow-sm hover:shadow-premium hover:scale-[1.01]"
                }`}
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
