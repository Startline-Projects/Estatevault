import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="bg-navy py-20 px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white">
          Start protecting your family today.
        </h2>
        <p className="mt-4 text-blue-100/60">
          Free quiz. No credit card needed until you choose a package.
        </p>
        <Link
          href="/quiz"
          className="mt-8 inline-flex items-center rounded-full bg-gold px-10 py-4 text-base font-semibold text-white hover:bg-gold/90 transition-colors shadow-lg"
        >
          Take the Free Quiz
        </Link>
      </div>
    </section>
  );
}
