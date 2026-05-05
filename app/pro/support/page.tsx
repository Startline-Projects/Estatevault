"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

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
      "You earn a fixed commission for every document your clients complete. Will packages earn you $300 (Standard) or $350 (Enterprise), and trust packages earn $400 or $450 respectively. Payouts transfer instantly to your Stripe Connect account on every sale. No minimum, no weekly batching — bank deposit timing follows your Stripe payout schedule.",
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

const VAULT_FAQS = [
  {
    question: "How do clients access my vault?",
    answer:
      "Share your unique vault URL (e.g. yourname.estatevault.us) with clients. They sign up directly on your branded vault page. You can find and copy your vault URL from your dashboard at any time.",
  },
  {
    question: "What can clients store in the vault?",
    answer:
      "Clients can securely store estate documents, insurance policies, financial account details (masked), digital credentials, physical asset locations, trusted contacts, and final wishes — including a farewell video message for their family.",
  },
  {
    question: "How is vault data protected?",
    answer:
      "All vault data is encrypted at rest and in transit. Clients set a separate vault PIN that is distinct from their account password. Neither you nor EstateVault staff can access the contents of a client's vault without trustee authorization.",
  },
  {
    question: "What is a vault trustee?",
    answer:
      "Clients can designate 1–2 trustees — trusted people who can request access to the vault in the event of the client's death or incapacitation. Trustees go through a 72-hour review period and identity verification before access is granted.",
  },
  {
    question: "How much does vault access cost clients?",
    answer:
      "Vault subscriptions are $99 per year per client. As a Basic partner, 100% of the subscription revenue goes to you — EstateVault does not take a cut. Subscriptions renew annually and are managed automatically via Stripe.",
  },
  {
    question: "What happens if a client cancels their subscription?",
    answer:
      "Clients retain read-only access until the end of their billing period. After that, their vault is locked but data is retained for 90 days. They can reactivate at any time to regain full access.",
  },
];

export default function ProSupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tier, setTier] = useState<string>("");

  useEffect(() => {
    async function loadTier() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase.from("partners").select("tier").eq("profile_id", user.id).single();
      if (partner) setTier(partner.tier || "standard");
    }
    loadTier();
  }, []);

  const isBasic = tier === "basic";
  const activeFaqs = isBasic ? VAULT_FAQS : FAQS;

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
          {activeFaqs.map((faq, index) => (
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
