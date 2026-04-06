const steps = [
  {
    number: 1,
    title: "Tell us about your family",
    description:
      "A short, guided conversation about your life and wishes. Plain English — no legal jargon.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    number: 2,
    title: "Your plan is created",
    description:
      "Personalized, attorney-reviewed documents built specifically for your family and Michigan law.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    number: 3,
    title: "Everything is secured",
    description:
      "Your documents and family vault, encrypted and accessible whenever your loved ones need them.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-24 px-6">
      <div className="mx-auto max-w-5xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-4 py-1.5 mb-4">
          <span className="text-xs font-semibold text-navy tracking-wide uppercase">Three Steps</span>
        </div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-navy tracking-tight">
          Built Around Your Life
        </h2>
        <p className="mt-4 text-lg text-charcoal/60 max-w-xl mx-auto">
          From first question to fully protected — in about 15 minutes.
        </p>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {steps.map((step, idx) => (
            <div key={step.number} className="relative group">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-gold/40 to-gold/10" />
              )}

              <div className="relative flex flex-col items-center p-8 rounded-2xl bg-white border border-gray-100 shadow-premium hover:shadow-premium-lg hover:border-gold/20 transition-all duration-300 hover:-translate-y-1">
                {/* Step number badge */}
                <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-gold/10 text-xs font-bold text-gold">
                  Step {step.number}
                </div>

                {/* Icon */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-navy to-navy-800 text-white shadow-lg group-hover:scale-105 transition-transform duration-300">
                  {step.icon}
                </div>

                <h3 className="mt-6 text-lg font-bold text-navy">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm text-charcoal/60 leading-relaxed max-w-xs">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
