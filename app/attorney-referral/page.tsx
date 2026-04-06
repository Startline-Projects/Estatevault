import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function AttorneyReferralPage() {
  return (
    <>
      <Header />
      <main className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-navy mb-4">
            We&apos;ll Connect You With the Right Attorney
          </h1>
          <p className="text-lg text-charcoal/70 mb-12">
            Some situations benefit from personalized guidance from a licensed
            attorney. We&apos;re here to help you find the right one.
          </p>

          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-10 mb-10">
            <p className="text-lg text-charcoal leading-relaxed mb-6">
              Based on your answers, your situation may require personalized
              legal guidance from a licensed attorney. EstateVault provides
              document preparation services and is not a substitute for legal
              counsel. A licensed Michigan attorney can review your
              circumstances and help you make informed decisions about your
              estate plan.
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-navy uppercase tracking-wide mb-1">
                  Get in Touch
                </h3>
                <p className="text-charcoal">
                  Email:{" "}
                  <a
                    href="mailto:attorneys@estatevault.us"
                    className="text-gold hover:underline font-medium"
                  >
                    attorneys@estatevault.us
                  </a>
                </p>
                <p className="text-charcoal">
                  Phone:{" "}
                  <a
                    href="tel:+18005551234"
                    className="text-gold hover:underline font-medium"
                  >
                    (800) 555-1234
                  </a>
                </p>
              </div>
            </div>
          </div>

          <p className="text-charcoal/60 text-sm mb-8">
            EstateVault is a document preparation platform and does not provide
            legal advice. Contacting an attorney through this page does not
            create an attorney-client relationship with EstateVault.
          </p>

          <Link
            href="/"
            className="inline-block rounded-lg bg-navy px-8 py-3 text-white font-medium hover:bg-navy-800 transition-colors"
          >
            Return Home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
