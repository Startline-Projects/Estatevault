const steps = [
  {
    number: 1,
    title: "Answer a few questions",
    description:
      "Our smart quiz learns about your family in plain English.",
  },
  {
    number: 2,
    title: "We build your documents",
    description:
      "Attorney-reviewed templates create your personalized plan.",
  },
  {
    number: 3,
    title: "Protect everything",
    description:
      "Your documents and your family\u2019s vault, all in one place.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 px-6">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-navy">
          How It Works
        </h2>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-10">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-white text-xl font-bold">
                {step.number}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-navy">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-charcoal/70 max-w-xs">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
