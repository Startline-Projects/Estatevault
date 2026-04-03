const testimonials = [
  {
    quote:
      "Getting my trust done was so much easier than I expected. 15 minutes and it was done.",
    name: "Sarah M.",
    city: "Grand Rapids",
    initials: "SM",
  },
  {
    quote:
      "My financial advisor recommended this. The vault feature alone is worth it.",
    name: "James T.",
    city: "Detroit",
    initials: "JT",
  },
  {
    quote:
      "I kept putting off estate planning for years. This made it finally happen.",
    name: "Linda K.",
    city: "Ann Arbor",
    initials: "LK",
  },
];

export default function SocialProof() {
  return (
    <section className="bg-white py-24 px-6">
      <div className="mx-auto max-w-5xl text-center">
        {/* Stats */}
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 mb-6">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700 tracking-wide uppercase">Trusted Platform</span>
          </div>
          <p className="text-6xl md:text-7xl font-bold text-navy tracking-tight">
            2,847
          </p>
          <p className="mt-2 text-lg text-charcoal/50">
            Michigan families protected
          </p>
        </div>

        {/* Testimonials */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="group rounded-2xl border border-gray-100 bg-white p-7 text-left shadow-premium hover:shadow-premium-lg hover:border-gold/20 transition-all duration-300 hover:-translate-y-0.5"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="text-sm text-charcoal/70 leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy">{t.name}</p>
                  <p className="text-xs text-charcoal/40">{t.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
