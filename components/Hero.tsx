import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-navy py-20 px-6 md:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
          Protect Your Family. It Takes 15 Minutes.
        </h1>
        <p className="mt-6 text-lg md:text-xl text-blue-100/80 max-w-2xl mx-auto">
          Attorney-reviewed wills and trusts, built for Michigan. Secure.
          Simple. Complete with your family&apos;s vault.
        </p>

        <ul className="mt-4 mb-4 flex flex-col items-center gap-1 text-sm text-blue-100/60">
          <li>&#8226; A will gives instructions for the judge</li>
          <li>&#8226; A trust avoids court and a judge</li>
        </ul>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/quiz"
            className="rounded-full bg-gold px-8 py-3.5 text-base font-semibold text-white hover:bg-gold/90 transition-colors shadow-lg"
          >
            Take the Free Quiz
          </Link>
          <div className="flex gap-3">
            <Link
              href="/will"
              className="rounded-full border border-white/60 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Create a Will
            </Link>
            <Link
              href="/trust"
              className="rounded-full border border-white/60 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Create a Trust
            </Link>
          </div>
        </div>

        <p className="mt-8 text-sm text-blue-100/60">
          🔒 Attorney-Reviewed &middot; State-Specific &middot; SSL Secured
        </p>
      </div>
    </section>
  );
}
