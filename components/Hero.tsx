import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative hero-gradient overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gold/5 blur-3xl animate-float" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full bg-gold/5 blur-3xl animate-float-delayed" />
        <div className="absolute -bottom-20 right-1/4 w-64 h-64 rounded-full bg-white/3 blur-3xl animate-float-slow" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative z-10 py-24 px-6 md:py-32 lg:py-40">
        <div className="mx-auto max-w-4xl text-center">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 py-1.5 mb-8">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-white/70 tracking-wide uppercase">
              Trusted by 2,847+ Michigan Families
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] tracking-tight">
            Protect Your Family.
            <br />
            <span className="text-gradient">Peace of Mind in Minutes.</span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            Attorney-reviewed wills and trusts built for Michigan families.
            Your documents and a secure family vault — all in one place.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            {/* Primary actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/will"
                className="group relative w-full sm:w-auto rounded-full bg-gold px-10 py-4 text-base font-semibold text-white transition-all duration-300 shadow-gold hover:shadow-gold-lg hover:scale-[1.02] active:scale-[0.98] text-center overflow-hidden"
              >
                <span className="relative z-10">Create a Will</span>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gold to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link
                href="/trust"
                className="group relative w-full sm:w-auto rounded-full bg-white/10 border border-white/25 px-10 py-4 text-base font-semibold text-white transition-all duration-300 hover:bg-white/20 hover:border-white/40 hover:scale-[1.02] active:scale-[0.98] text-center"
              >
                Create a Trust
              </Link>
            </div>

            {/* Secondary quiz CTA */}
            <Link
              href="/quiz"
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors duration-200 mt-1 group"
            >
              <span className="w-px h-3 bg-white/20 hidden sm:block" />
              <span>Not sure?</span>
              <span className="font-medium text-white/70 group-hover:text-white underline underline-offset-2 decoration-white/30 group-hover:decoration-white/60 transition-all duration-200">
                Take a free quiz
              </span>
              <svg className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Trust signals */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-white/50">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              SSL Secured
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
              256-bit Encrypted
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Attorney-Reviewed
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
