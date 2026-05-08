import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-navy mb-2">
            Privacy Policy
          </h1>
          <p className="text-charcoal/60 mb-12">Last updated: April 1, 2026</p>

          <div className="space-y-10 text-charcoal leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                Information We Collect
              </h2>
              <p className="mb-3">
                When you use EstateVault, we collect information that you provide
                directly, including your name, email address, phone number, and
                the responses you submit during our guided questionnaire process.
                We also collect information necessary to prepare your estate
                planning documents, such as family details, asset information,
                and beneficiary designations.
              </p>
              <p>
                We automatically collect certain technical information when you
                visit our platform, including your IP address, browser type,
                device information, and usage patterns. This helps us improve our
                services and ensure platform security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                How We Use Your Information
              </h2>
              <p className="mb-3">
                We use your information to provide our document preparation
                services, including generating estate planning documents based
                on your responses. Your data is also used to manage your account,
                process payments, communicate important updates, and maintain the
                security of our platform.
              </p>
              <p>
                We do not sell your personal information to third parties. We may
                share information with trusted service providers who assist us in
                operating our platform, processing payments, and delivering
                services to you.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                Data Security
              </h2>
              <p className="mb-3">
                We take the security of your information seriously. All data
                transmitted to and from our platform is encrypted using
                industry-standard TLS encryption. Documents stored in your
                digital vault are protected with additional encryption, and vault
                access requires a separate PIN from your account password.
              </p>
              <p>
                We implement administrative, technical, and physical safeguards
                designed to protect your personal information from unauthorized
                access, disclosure, alteration, and destruction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                Your Rights
              </h2>
              <p className="mb-3">
                You have the right to access, correct, or delete the personal
                information we hold about you. You may also request a copy of
                your data in a portable format. To exercise any of these rights,
                please contact us using the information provided below.
              </p>
              <p>
                You may opt out of promotional communications at any time by
                clicking the unsubscribe link in any email or by contacting our
                support team.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                Contact Us
              </h2>
              <p>
                If you have questions about this Privacy Policy or how we handle
                your information, please contact us at{" "}
                <a
                  href="mailto:info@estatevault.us"
                  className="text-gold hover:underline"
                >
                  info@estatevault.us
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
