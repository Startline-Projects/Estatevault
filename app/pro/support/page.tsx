"use client";

import { useState } from "react";

const CONTACT_CARDS = [
  {
    icon: "💬",
    title: "Live Chat",
    description: "Chat with our partner success team in real time.",
    action: "Start Chat",
    detail: "Available Mon-Fri, 9am-6pm ET",
  },
  {
    icon: "📧",
    title: "Email Support",
    description: "Send us a message and we will respond within 24 hours.",
    action: "partners@estatevault.com",
    detail: "Response within 1 business day",
  },
  {
    icon: "📞",
    title: "Compliance Hotline",
    description: "Urgent compliance questions or hard stop escalations.",
    action: "(855) 555-0199",
    detail: "Available 24/7 for compliance issues",
  },
];

const FAQS = [
  {
    question: "How do I get paid for client documents?",
    answer:
      "You earn a fixed commission for every document your clients complete. Will packages earn you $300 (Standard) or $350 (Enterprise), and trust packages earn $400 or $450 respectively. Payouts are processed every Friday via Stripe Connect or ACH. The minimum payout is $50, anything below rolls to the following week.",
  },
  {
    question: "What happens when a client triggers a hard stop?",
    answer:
      "If a client indicates they have a special needs dependent or need an irrevocable trust, document generation halts automatically. The client is routed to a licensed attorney for consultation. You earn a $75 referral fee if the case converts. This is a compliance safeguard and cannot be overridden.",
  },
  {
    question: "Can I change the pricing my clients see?",
    answer:
      "No. Pricing is fixed by EstateVault to maintain a premium brand and ensure consistent earnings for all partners. Will packages are $400, trust packages are $600, attorney review is $300, and amendments are $50. These prices cannot be modified.",
  },
  {
    question: "How does the certification training work?",
    answer:
      "Certification consists of 4 training modules (approximately 3.5 hours total) followed by a short exam. You must complete certification before you can facilitate client sessions. This ensures all partners understand compliance boundaries, platform features, and client conversation best practices.",
  },
  {
    question: "Can I add team members to my account?",
    answer:
      "Standard plans include up to 3 team seats, and Enterprise plans include up to 10. You can invite team members from Settings > Team. Each team member will need to complete their own certification training before they can manage client sessions.",
  },
];

export default function ProSupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function toggleFaq(index: number) {
    setOpenFaq(openFaq === index ? null : index);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-navy">Support</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Get help from our partner success team.
      </p>

      {/* Contact cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {CONTACT_CARDS.map((card) => (
          <div
            key={card.title}
            className="rounded-xl bg-white border border-gray-200 p-5"
          >
            <span className="text-2xl">{card.icon}</span>
            <h3 className="mt-3 text-sm font-bold text-navy">{card.title}</h3>
            <p className="mt-1 text-xs text-charcoal/60">{card.description}</p>
            <p className="mt-3 text-sm font-semibold text-gold">{card.action}</p>
            <p className="mt-1 text-xs text-charcoal/60">{card.detail}</p>
          </div>
        ))}
      </div>

      {/* FAQ accordion */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-navy">Frequently Asked Questions</h2>
        <div className="mt-4 space-y-3">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl bg-white border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-navy pr-4">
                  {faq.question}
                </span>
                <span
                  className={`text-charcoal/30 transition-transform flex-shrink-0 ${
                    openFaq === index ? "rotate-180" : ""
                  }`}
                >
                  &#9660;
                </span>
              </button>
              {openFaq === index && (
                <div className="px-6 pb-4 border-t border-gray-100 pt-3">
                  <p className="text-sm text-charcoal/70 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
