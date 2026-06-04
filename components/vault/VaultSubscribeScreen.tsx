"use client";

interface VaultSubscribeScreenProps {
  formattedPrice: string;
  submitting?: boolean;
  onSubscribe: () => void;
}

const BENEFITS = [
  { icon: "📄", title: "Estate Documents", desc: "Wills, trusts & directives in one secure place" },
  { icon: "🏦", title: "Financial Accounts", desc: "Track accounts so nothing is ever lost" },
  { icon: "🛡", title: "Insurance Policies", desc: "Keep coverage details ready for your family" },
  { icon: "🔑", title: "Digital Accounts", desc: "Logins & memorial wishes, protected" },
  { icon: "👤", title: "Important Contacts", desc: "Attorneys, advisors & executors on hand" },
  { icon: "🎥", title: "Farewell Messages", desc: "Record video messages for loved ones" },
];

export default function VaultSubscribeScreen({
  formattedPrice,
  submitting = false,
  onSubscribe,
}: VaultSubscribeScreenProps) {
  return (
    <div className="max-w-lg mx-auto py-12 text-center">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center">
          <span className="text-3xl">🔐</span>
        </div>
      </div>
      <h1 className="mt-6 text-2xl font-bold text-navy">Protect Your Family Vault</h1>
      <p className="mt-2 text-sm text-charcoal/60">
        Securely store everything your family needs in one protected place. Subscribe to unlock your
        vault for {formattedPrice}/year.
      </p>

      <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <div
            key={b.title}
            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gold/5 p-4"
          >
            <span className="text-2xl leading-none">{b.icon}</span>
            <div>
              <p className="text-sm font-semibold text-navy">{b.title}</p>
              <p className="mt-0.5 text-xs text-charcoal/60">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onSubscribe}
        disabled={submitting}
        className="mt-8 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
        {submitting ? "Redirecting…" : `Subscribe, ${formattedPrice}/year`}
      </button>
      <p className="mt-3 text-xs text-charcoal/40">
        You&apos;ll set up your private vault PIN right after subscribing.
      </p>
    </div>
  );
}
