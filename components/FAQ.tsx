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

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="text-base font-medium text-navy">{q}</span>
        <span className="ml-4 text-xl text-gold shrink-0">
          {open ? "\u2212" : "+"}
        </span>
      </button>
      {open && (
        <div className="pb-5 pr-8">
          <p className="text-sm text-charcoal/70 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <section id="faq" className="bg-gray-50 py-20 px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-navy text-center">
          Common Questions
        </h2>

        <div className="mt-12">
          {faqs.map((faq) => (
            <AccordionItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
