import Link from "next/link";

export default function HardStopCard() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/95 px-6">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <span className="text-3xl">⚠</span>
        </div>
        <h2 className="mt-6 text-xl font-bold text-navy">
          Your family&apos;s situation includes a special needs dependent.
        </h2>
        <p className="mt-4 text-sm text-charcoal/70 leading-relaxed">
          This requires a specialized legal trust that our platform cannot
          generate. We&apos;ll connect you with a licensed Michigan estate
          planning attorney.
        </p>
        <Link
          href="/attorney-referral"
          className="mt-8 inline-flex min-h-[44px] items-center rounded-full bg-navy px-8 py-3 text-sm font-semibold text-white hover:bg-navy/90 transition-colors"
        >
          Connect with an Attorney
        </Link>
      </div>
    </div>
  );
}
