const testimonials = [
  {
    quote:
      "Getting my trust done was so much easier than I expected. 15 minutes and it was done.",
    name: "Sarah M.",
    city: "Grand Rapids",
  },
  {
    quote:
      "My financial advisor recommended this. The vault feature alone is worth it.",
    name: "James T.",
    city: "Detroit",
  },
  {
    quote:
      "I kept putting off estate planning for years. This made it finally happen.",
    name: "Linda K.",
    city: "Ann Arbor",
  },
];

export default function SocialProof() {
  return (
    <section className="bg-white py-20 px-6">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-5xl md:text-6xl font-bold text-navy">2,847</p>
        <p className="mt-2 text-lg text-charcoal/70">
          Michigan families protected
        </p>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-left"
            >
              <p className="text-sm text-charcoal/80 leading-relaxed italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <p className="mt-4 text-sm font-semibold text-navy">
                {t.name},{" "}
                <span className="font-normal text-charcoal/60">{t.city}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
