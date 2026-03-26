import Link from "next/link";

export default function VaultCTA() {
  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
      <h2 className="text-lg font-bold text-navy">Set up your Family Vault</h2>
      <p className="mt-3 text-sm text-charcoal/60 leading-relaxed max-w-sm mx-auto">
        Your documents are automatically saved to your vault. Add your insurance
        policies, financial accounts, and digital credentials so your family has
        everything they need.
      </p>
      <Link
        href="/dashboard/vault"
        className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-gold px-8 py-3 text-sm font-semibold text-white hover:bg-gold/90 transition-colors shadow-md"
      >
        Set Up My Vault
      </Link>
      <div className="mt-3">
        <Link
          href="/dashboard"
          className="text-sm text-navy/60 hover:text-navy transition-colors"
        >
          I&apos;ll do this later
        </Link>
      </div>
    </div>
  );
}
