import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-navy mb-2">
            Terms of Service
          </h1>
          <p className="text-charcoal/60 mb-12">Last updated: April 1, 2026</p>

          <div className="space-y-10 text-charcoal leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                Acceptance of Terms
              </h2>
              <p>
                By accessing or using the EstateVault platform, you agree to be
                bound by these Terms of Service. If you do not agree to these
                terms, you may not use our services. We reserve the right to
                update these terms at any time, and continued use of the
                platform after changes constitutes acceptance of the revised
                terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                Services Description
              </h2>
              <p className="mb-3 font-semibold">
                This platform provides document preparation services only. It
                does not provide legal advice.
              </p>
              <p>
                EstateVault offers a guided questionnaire process that generates
                estate planning documents based on your responses. The documents
                produced are informational in nature and are prepared according
                to the information you provide. EstateVault is not a law firm,
                and no attorney-client relationship is created by your use of
                this platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                User Accounts
              </h2>
              <p className="mb-3">
                You are responsible for maintaining the confidentiality of your
                account credentials, including your password and vault PIN. You
                agree to notify us immediately of any unauthorized use of your
                account.
              </p>
              <p>
                You must provide accurate and complete information when creating
                your account and when completing any questionnaire on our
                platform. Inaccurate information may result in documents that do
                not reflect your intentions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                Payment Terms
              </h2>
              <p className="mb-3">
                All payments are processed securely through our third-party
                payment processor. Prices for our services are displayed on the
                platform and are subject to change with notice. Payment is
                required before document generation begins.
              </p>
              <p>
                Refund requests are evaluated on a case-by-case basis. Please
                contact our support team if you believe a refund is warranted.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                Limitation of Liability
              </h2>
              <p className="mb-3">
                EstateVault provides document preparation tools and does not
                guarantee that documents produced will be suitable for your
                specific legal needs. You acknowledge that estate planning
                involves complex legal considerations and that consulting with a
                licensed attorney may be appropriate for your situation.
              </p>
              <p>
                To the maximum extent permitted by law, EstateVault shall not be
                liable for any indirect, incidental, special, consequential, or
                punitive damages arising out of or related to your use of our
                services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-navy mb-4">
                Governing Law
              </h2>
              <p>
                These Terms of Service are governed by and construed in
                accordance with the laws of the State of Michigan, without
                regard to its conflict of law provisions. Any disputes arising
                from these terms or your use of our platform shall be resolved
                in the courts located in the State of Michigan.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
