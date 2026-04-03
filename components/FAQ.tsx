"use client";

import { useState } from "react";

const faqs = [
  {
    q: "Are these real legal documents?",
    a: "Yes. All documents are attorney-reviewed, Michigan-specific, and legally valid when properly executed. They are not generic templates.",
  },
  {
    q: "How long does it take?",
    a: "Most clients complete the quiz and intake in 10\u201315 minutes. Your documents are generated immediately after purchase.",
  },
  {
    q: "What is the Family Vault?",
    a: "The Vault is a secure encrypted storage system inside your account where you can store your estate documents, insurance policies, financial account details, and digital credentials \u2014 everything your family needs in one place.",
  },
  {
    q: "Is my information secure?",
    a: "Yes. All data is protected with 256-bit AES encryption. Your Vault has a separate PIN from your account password. Our platform meets bank-grade security standards.",
  },
  {
    q: "What happens after I purchase?",
    a: "Your documents are generated immediately. You receive a download link by email and permanent access through your account. An execution guide walks you through signing requirements.",
  },
  {
    q: "Can I update my documents later?",
    a: "Yes. Life events like marriage, divorce, new children, or new property can be reflected through a document amendment for $50.",
  },
];

function AccordionItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`border border-transparent rounded-xl transition-all duration-300 ${isOpen ? "bg-navy-50/50 border-navy-100" : "hover:bg-gray-50"}`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span className={`text-base font-medium transition-colors duration-200 ${isOpen ? "text-navy" : "text-charcoal/80"}`}>
          {q}
        </span>
        <span
          className={`ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            isOpen ? "bg-navy text-white rotate-180" : "bg-gray-100 text-charcoal/40"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </button>
      <div
        className="accordion-content"
        style={{ maxHeight: isOpen ? "200px" : "0px", opacity: isOpen ? 1 : 0 }}
      >
        <div className="px-6 pb-5">
          <p className="text-sm text-charcoal/60 leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-gradient-to-b from-white to-gray-50 py-24 px-6">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-4 py-1.5 mb-4">
            <span className="text-xs font-semibold text-navy tracking-wide uppercase">FAQ</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-navy tracking-tight">
            Common Questions
          </h2>
          <p className="mt-4 text-lg text-charcoal/50">
            Everything you need to know about protecting your family.
          </p>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq.q}
              q={faq.q}
              a={faq.a}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
