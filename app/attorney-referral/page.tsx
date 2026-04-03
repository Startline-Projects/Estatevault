import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function AttorneyReferralPage() {
  return (
    <>
      <Header />
      <main className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-[#1C3557] mb-4">
            Connect With a Licensed Attorney
          </h1>
          <p className="text-lg text-[#2D2D2D]/70 mb-12">
            Your situation may require personalized guidance from a qualified
            legal professional in Michigan.
          </p>

          <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-10 mb-10">
            <p className="text-lg text-[#2D2D2D] leading-relaxed mb-6">
              Based on your answers, your situation may require personalized
              legal guidance from a licensed attorney. EstateVault provides
              document preparation services and is not a substitute for legal
              counsel. A licensed Michigan attorney can review your
              circumstances and help you make informed decisions about your
              estate plan.
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#1C3557] uppercase tracking-wide mb-1">
                  Get in Touch
                </h3>
                <p className="text-[#2D2D2D]">
                  Email:{" "}
                  <a
                    href="mailto:attorneys@estatevault.us"
                    className="text-[#C9A84C] hover:underline font-medium"
                  >
                    attorneys@estatevault.us
                  </a>
                </p>
                <p className="text-[#2D2D2D]">
                  Phone:{" "}
                  <a
                    href="tel:+18005551234"
                    className="text-[#C9A84C] hover:underline font-medium"
                  >
                    (800) 555-1234
                  </a>
                </p>
              </div>
            </div>
          </div>

          <p className="text-[#2D2D2D]/60 text-sm mb-8">
            EstateVault is a document preparation platform and does not provide
            legal advice. Contacting an attorney through this page does not
            create an attorney-client relationship with EstateVault.
          </p>

          <Link
            href="/"
            className="inline-block rounded-lg bg-[#1C3557] px-8 py-3 text-white font-medium hover:bg-[#1C3557]/90 transition-colors"
          >
            Return Home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
